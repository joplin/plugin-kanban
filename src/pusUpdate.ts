let _isThereUpdate = false;
let _waiting: VoidFunction | null = null;

export const pushUpdate = () => {
  if (_waiting) _waiting();
  else _isThereUpdate = true;
};

export const waitForUpdate = async () => {
  if (_isThereUpdate) {
    _isThereUpdate = false;
  } else {
    return new Promise<void>((resolve) => {
      _waiting = resolve;
    });
  }
};
