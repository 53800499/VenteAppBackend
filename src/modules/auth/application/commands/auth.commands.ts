export interface LoginPinCommand {
  pin: string;
  shopId: number;
  userId?: number;
}

export interface SetupOwnerCommand {
  ownerName: string;
  shopName: string;
  pin: string;
  shopAddress?: string;
  shopPhone?: string;
}

export interface EmergencyUnlockCommand {
  recoveryToken: string;
  shopId: number;
  userId?: number;
}

export interface EnableBiometricCommand {
  userId: number;
  pin: string;
  sessionToken: string;
}
