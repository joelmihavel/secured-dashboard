/**
 * TypeScript declarations for PayU Core SDK (Mode B / CBWrapper)
 *
 * Modules:
 * - payu-core-pg-react: Core payment gateway (PayUSdk)
 * - payu-custom-browser-react: Custom Browser wrapper (CBWrapper)
 *
 * IMPORTANT: We ONLY use Mode B (CBWrapper.openCB) — never Mode A (PayUSdk.makePayment).
 * Mode A requires the merchant salt on the client which is a security disqualification.
 */

// ===================================================
// payu-core-pg-react
// ===================================================

declare module 'payu-core-pg-react' {
  /**
   * Core SDK module — exposes makePayment (Mode A) which we DO NOT use.
   * Imported only for type reference; actual payments go through CBWrapper.
   */
  interface PayUSdkModule {
    /**
     * Mode A payment — NEVER USE THIS.
     * Takes salt directly on client, extractable via Frida/decompilation.
     */
    makePayment(
      params: Record<string, unknown>,
      successCallback: (response: string) => void,
      errorCallback: (error: string) => void,
    ): void;
  }

  const PayUSdk: PayUSdkModule;
  export default PayUSdk;
}

// ===================================================
// payu-custom-browser-react
// ===================================================

declare module 'payu-custom-browser-react' {
  /**
   * PayU payment params for CBWrapper (Mode B).
   * Uses snake_case naming convention.
   */
  export interface PayUPaymentParamsCB {
    key: string;
    transaction_id: string;
    amount: string;
    product_info: string;
    first_name: string;
    email: string;
    phone: string;
    /** surl for iOS */
    ios_surl: string;
    /** furl for iOS */
    ios_furl: string;
    /** surl for Android */
    android_surl: string;
    /** furl for Android */
    android_furl: string;
    /** "0" = production, "1" = sandbox */
    environment: string;
    /** Format: "merchant_key:user_identifier" */
    user_credentials: string;
    /** Pre-computed hashes from server */
    hashes: {
      payment: string;
      vas?: string;
      payment_related_details?: string;
    };
    additional_param?: {
      udf1?: string;
      udf2?: string;
      udf3?: string;
      udf4?: string;
      udf5?: string;
    };
    // Card-specific params
    /** "CC" for credit, "DC" for debit */
    bankcode?: string;
    card_number?: string;
    cvv?: string;
    /** 4-digit year, e.g. "2027" */
    expiry_year?: string;
    /** 2-digit zero-padded month, e.g. "05" */
    expiry_month?: string;
    name_on_card?: string;
    /** "0" = don't store, "1" = store */
    store_card?: string;
    // Net banking params (bankcode is the bank code e.g. "SBIB")
    // UPI params
    /** VPA for UPI collect */
    vpa?: string;
  }

  /**
   * CBWrapper openCB config — uses snake_case key per native SDK.
   */
  export interface CBOpenConfig {
    payu_payment_params: PayUPaymentParamsCB;
  }

  /**
   * CBListener event from DeviceEventEmitter.
   * NOTE: SDK has a known typo — "eveneType" instead of "eventType" on some events.
   */
  export interface CBListenerEvent {
    eventType?: string;
    /** SDK typo — check both */
    eveneType?: string;
    payuResult?: string;
    merchantResponse?: string;
    isTxnInitiated?: boolean;
    /** Android typo variant */
    ixTxnInitiated?: boolean;
    error?: string;
  }

  /**
   * CBListener event types.
   */
  export type CBEventType =
    | 'onPaymentSuccess'
    | 'onPaymentFailure'
    | 'onPaymentTerminate'
    | 'onCBErrorReceived'
    | 'onBackButton'
    | 'onBackApprove'
    | 'onBackDismiss';

  /**
   * Custom Browser wrapper — Mode B.
   * Safe: takes pre-computed hashes, salt stays server-side.
   * Native method is openCB (3 args: config, errorCallback, successCallback).
   * successCallback fires when webview is presented, NOT when payment succeeds.
   * Actual payment outcome arrives via CBListener events.
   */
  interface CBWrapperModule {
    openCB(
      config: CBOpenConfig,
      errorCallback: (error: string) => void,
      successCallback: (initMessage: string) => void,
    ): void;
  }

  const CBWrapper: CBWrapperModule;
  export default CBWrapper;
}
