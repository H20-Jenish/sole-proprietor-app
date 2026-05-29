let presenter = null;

export function registerSecurityGatePresenter(nextPresenter) {
  presenter = nextPresenter;
  return () => {
    if (presenter === nextPresenter) presenter = null;
  };
}

export function requestSecurityGate(options) {
  if (!presenter) {
    return Promise.resolve({ confirmed: false, password: '' });
  }
  return presenter(options || {});
}
