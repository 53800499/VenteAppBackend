const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// 1. Charger les variables d'environnement depuis .env ou .env.local
function loadEnv() {
  const envFiles = ['.env', '.env.local'];
  const env = { ...process.env };

  for (const f of envFiles) {
    const fullPath = path.resolve(__dirname, '..', f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!env[key]) {
            env[key] = val;
          }
        }
      }
    }
  }
  return env;
}

// 2. Parser les arguments CLI
function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx > 0) {
        const key = arg.substring(2, eqIdx).trim();
        const val = arg.substring(eqIdx + 1).trim();
        args[key] = val;
      } else {
        args[arg.substring(2)] = true;
      }
    }
  }
  return args;
}

async function main() {
  console.log('\n🚀 [ARIKE] Assistant de publication de mise à jour (Supabase Storage)\n');

  const args = parseArgs();
  const env = loadEnv();

  const platform = (args.platform || 'ANDROID').toUpperCase();
  const version = args.version || '1.0.1';
  const build = parseInt(args.build || '2', 10);
  const minBuild = parseInt(args.minBuild || '1', 10);
  const forceUpdate = args.force === 'true' || args.force === true;
  const releaseNotes = args.notes || '• Améliorations de performance\n• Corrections de bugs et stabilité';

  // Fichier par défaut selon plateforme
  let filePath = args.file;
  if (!filePath) {
    if (platform === 'ANDROID') {
      filePath = path.resolve(__dirname, '../../frontend/build/app/outputs/flutter-apk/app-release.apk');
    } else {
      filePath = path.resolve(__dirname, '../../frontend/build/windows/runner/Release/arike-setup.exe');
    }
  } else {
    filePath = path.resolve(process.cwd(), filePath);
  }

  console.log(`📦 Plateforme    : ${platform}`);
  console.log(`🏷️  Version       : ${version} (Build ${build})`);
  console.log(`🔒 Force update  : ${forceUpdate ? 'OUI (Obligatoire)' : 'NON (Optionnel)'}`);
  console.log(`📁 Fichier source : ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ ERREUR: Le fichier binaire n'existe pas : ${filePath}`);
    console.log(`👉 Pour Android, compilez d'abord avec : cd frontend && flutter build apk --release\n`);
    process.exit(1);
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ ERREUR: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY introuvable dans .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 3. Calcul de la taille et de l'empreinte SHA-256
  console.log('\n⏳ Calcul de l\'empreinte SHA-256 et lecture du fichier...');
  const fileBuffer = fs.readFileSync(filePath);
  const fileSizeBytes = fileBuffer.length;
  const checksumSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const sizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`   Taille         : ${sizeMb} Mo (${fileSizeBytes} octets)`);
  console.log(`   SHA-256        : ${checksumSha256}`);

  // 4. Déterminer le chemin de destination sur Supabase Storage
  const ext = platform === 'ANDROID' ? 'apk' : 'exe';
  const storageFolder = platform === 'ANDROID' ? 'android' : 'windows';
  const storageFileName = platform === 'ANDROID' ? `arike-v${version}.apk` : `arike-setup-v${version}.exe`;
  const storagePath = `${storageFolder}/${storageFileName}`;
  const contentType = platform === 'ANDROID' ? 'application/vnd.android.package-archive' : 'application/x-msdownload';

  console.log(`\n⏳ Envoi vers Supabase Storage (Bucket: 'releases', Chemin: '${storagePath}')...`);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('releases')
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error(`❌ Échec de l'upload sur Supabase Storage : ${uploadError.message}`);
    console.log(`💡 Note: Assurez-vous d'avoir exécuté la migration 059_app_updates_and_storage.sql sur votre base Supabase.`);
    process.exit(1);
  }

  // 5. Récupération de l'URL publique
  const { data: publicUrlData } = supabase.storage.from('releases').getPublicUrl(storagePath);
  const downloadUrl = publicUrlData.publicUrl;
  console.log(`✅ Upload réussi !`);
  console.log(`🌐 URL publique : ${downloadUrl}`);

  // 6. Enregistrement / mise à jour dans la table app_releases
  console.log('\n⏳ Enregistrement de la version dans la table `app_releases`...');
  const { error: dbError } = await supabase.from('app_releases').upsert(
    {
      platform,
      version,
      build_number: build,
      minimum_build: minBuild,
      download_url: downloadUrl,
      checksum_sha256: checksumSha256,
      file_size_bytes: fileSizeBytes,
      force_update: forceUpdate,
      release_notes: releaseNotes,
      is_published: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'platform,build_number' }
  );

  if (dbError) {
    console.warn(`⚠️ Avertissement lors de l'enregistrement en base : ${dbError.message}`);
    console.log(`   (L'URL est néanmoins bien en place et active sur Supabase Storage)`);
  } else {
    console.log(`✅ Version enregistrée avec succès dans la base de données !`);
  }

  console.log('\n🎉 Mise à jour publiée avec succès pour ARIKE !');
  console.log('--------------------------------------------------');
  console.log(`Téléchargement : ${downloadUrl}`);
  console.log(`SHA-256        : ${checksumSha256}`);
  console.log('--------------------------------------------------\n');
}

main().catch((err) => {
  console.error('\n❌ Erreur inattendue :', err);
  process.exit(1);
});

