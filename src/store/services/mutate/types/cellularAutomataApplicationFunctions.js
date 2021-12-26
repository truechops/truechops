export function _N(noteValue) {
  return 1;
}
export function _R(noteValue) {
  return 0;
}
export function _F(noteValue) {
  return noteValue == 0 ? 1: 0;
}
export function _U(noteValue) {
  return noteValue;
}
export function _RF(noteValue) {
  // Random between 0,10
  if (Math.floor(Math.random() * 11) > 5) {
    return _F(noteValue);
  }
  return _R(noteValue);
}
