import { SetMetadata } from '@nestjs/common';
import { ArikeModule, ArikeCapability } from '../enums/module.enum';

export const REQUIRED_MODULES_KEY = 'required_modules';
export const REQUIRED_CAPABILITIES_KEY = 'required_capabilities';

/**
 * Déclare les modules SaaS requis pour accéder à une route ou un contrôleur.
 */
export const RequireModule = (...modules: (ArikeModule | string)[]) =>
  SetMetadata(REQUIRED_MODULES_KEY, modules);

/**
 * Déclare les capacités système requises pour accéder à une route ou un contrôleur.
 */
export const RequireCapability = (...capabilities: (ArikeCapability | string)[]) =>
  SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities);
