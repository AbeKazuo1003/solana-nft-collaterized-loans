import * as anchor from "@project-serum/anchor";

export type OrderData = {
    borrower: anchor.web3.PublicKey;
    stableCoinVault: anchor.web3.PublicKey;
    nftMint: anchor.web3.PublicKey;
    nftVault: anchor.web3.PublicKey;
    requestAmount: anchor.BN;
    interest: anchor.BN;
    period: anchor.BN;
    additionalCollateral: anchor.BN;
    lender: anchor.web3.PublicKey;
    createdAt: anchor.BN;
    loanStartTime: anchor.BN;
    paidBackAt: anchor.BN;
    withdrewAt: anchor.BN;
    orderStatus: boolean;
    orderId: anchor.BN;
    nonce: anchor.BN;
}

export class Order {
    publicKey: anchor.web3.PublicKey;
    borrower: anchor.web3.PublicKey;
    stableCoinVault: anchor.web3.PublicKey;
    nftMint: anchor.web3.PublicKey;
    nftVault: anchor.web3.PublicKey;
    requestAmount: anchor.BN;
    interest: anchor.BN;
    period: anchor.BN;
    additionalCollateral: anchor.BN;
    lender: anchor.web3.PublicKey;
    createdAt: string;
    loanStartTime: string;
    paidBackAt: string;
    withdrewAt: string;
    orderStatus: boolean;
    orderId: anchor.BN;
    nonce: anchor.BN;

    constructor(publicKey: anchor.web3.PublicKey, orderData: OrderData) {
        this.publicKey = publicKey;
        this.orderId = orderData.orderId;
        this.borrower = orderData.borrower;
        this.stableCoinVault = orderData.stableCoinVault;
        this.nftMint = orderData.nftMint;
        this.nftVault = orderData.nftVault;
        this.requestAmount = orderData.requestAmount;
        this.interest = orderData.interest;
        this.period = orderData.period;
        this.additionalCollateral = orderData.additionalCollateral;
        this.lender = orderData.lender;
        this.createdAt = orderData.createdAt.toString();
        this.loanStartTime = orderData.loanStartTime.toString();
        this.paidBackAt = orderData.paidBackAt.toString();
        this.withdrewAt = orderData.withdrewAt.toString();
        this.orderStatus = orderData.orderStatus;
        this.nonce = orderData.nonce;
    }

    get key() {
        return this.publicKey.toBase58();
    }

    get borrowerDisplay() {
        const author = this.borrower.toBase58();
        return author.slice(0, 4) + ".." + author.slice(-4);
    }

    get createdAtData() {
        const date = getDate(this.createdAt);
        return date.toLocaleDateString();
    }

    get loanStartTimeData() {
        const date = getDate(this.loanStartTime);
        return date.toLocaleDateString();
    }

    get paidBackAtData() {
        const date = getDate(this.paidBackAt);
        return date.toLocaleDateString();
    }

    get withdrewAtData() {
        const date = getDate(this.withdrewAt);
        return date.toLocaleDateString();
    }

}

// convert unix timestamp to js date object
const getDate = (timestamp: string) => {
    const utxDate = parseInt(timestamp);
    return new Date(utxDate * 1000);
};