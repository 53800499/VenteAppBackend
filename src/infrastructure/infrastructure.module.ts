import { Global, Module } from '@nestjs/common';
import { SupabaseModule } from './supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  exports: [SupabaseModule],
})
export class InfrastructureModule {}
