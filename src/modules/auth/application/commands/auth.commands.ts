export interface LoginPinCommand {
  pin: string;
  shopId: number;
  deviceId: string;
  deviceLabel?: string;
  userId?: number;
}

export interface SetupOwnerCommand {
  ownerName: string;
  shopName: string;
  pin: string;
  shopAddress?: string;
  shopPhone?: string;
  ownerPhone: string;
}

export interface EmergencyUnlockCommand {
  recoveryToken: string;
  shopId: number;
  deviceId: string;
  deviceLabel?: string;
  userId?: number;
}

export interface EnableBiometricCommand {
  userId: number;
  pin: string;
  sessionId: string;
}
