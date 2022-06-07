import * as anchor from "@project-serum/anchor";

export type ConfigData = {
    stableCoinMint: anchor.web3.PublicKey;
    stableCoinVault: anchor.web3.PublicKey;
    orderId: anchor.BN;
    totalAdditionCollateral: anchor.BN;
    nonce: anchor.BN;
}

export class Config {
    publicKey: anchor.web3.PublicKey;
    stableCoinMint: anchor.web3.PublicKey;
    stableCoinVault: anchor.web3.PublicKey;
    orderId: anchor.BN;
    totalAdditionCollateral: anchor.BN;
    nonce: anchor.BN;

    constructor(publicKey: anchor.web3.PublicKey, configData: ConfigData) {
        this.publicKey = publicKey;
        this.stableCoinMint = configData.stableCoinMint;
        this.stableCoinVault = configData.stableCoinVault;
        this.orderId = configData.orderId;
        this.totalAdditionCollateral = configData.totalAdditionCollateral;
        this.nonce = configData.nonce;
    }

    get key() {
        return this.publicKey.toBase58();
    }
}

