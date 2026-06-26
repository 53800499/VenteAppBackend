import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import authConfig from './auth.config';
import supabaseConfig from './supabase.config';
import whatsappConfig from './whatsapp.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, supabaseConfig, authConfig, whatsappConfig],
    }),
  ],
})
export class AppConfigModule {}
