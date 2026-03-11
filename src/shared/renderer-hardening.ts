export interface RendererHardeningPolicy {
  readonly webPreferences: {
    readonly nodeIntegration: false;
    readonly contextIsolation: true;
    readonly sandbox: true;
    readonly webSecurity: true;
  };
  readonly localProtocol: "app://";
  readonly contentSecurityPolicy: {
    readonly defaultSrc: "'none'";
    readonly scriptSrc: readonly ["'self'"];
    readonly styleSrc: readonly ["'self'"];
    readonly imgSrc: readonly ["'self'", "data:"];
    readonly connectSrc: readonly [];
  };
  readonly permissions: "default_deny";
  readonly navigation: "default_deny";
  readonly popups: "default_deny";
  readonly senderValidation: "required";
  readonly rawApiExposure: "forbidden";
}

export const rendererHardeningPolicy: RendererHardeningPolicy = {
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true
  },
  localProtocol: "app://",
  contentSecurityPolicy: {
    defaultSrc: "'none'",
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: []
  },
  permissions: "default_deny",
  navigation: "default_deny",
  popups: "default_deny",
  senderValidation: "required",
  rawApiExposure: "forbidden"
};

