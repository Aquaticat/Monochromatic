"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.curry = curry;
function curry(fn) {
    if (fn.length === 2) {
        return function fn0To(parameter0) {
            return function fn1(parameter1) {
                return fn(parameter0, parameter1);
            };
        };
    }
    if (fn.length === 3) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2(parameter2) {
                    return fn(parameter0, parameter1, parameter2);
                };
            };
        };
    }
    if (fn.length === 4) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2To(parameter2) {
                    return function fn3(parameter3) {
                        return fn(parameter0, parameter1, parameter2, parameter3);
                    };
                };
            };
        };
    }
    if (fn.length === 5) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2To(parameter2) {
                    return function fn3To(parameter3) {
                        return function fn4(parameter4) {
                            return fn(parameter0, parameter1, parameter2, parameter3, parameter4);
                        };
                    };
                };
            };
        };
    }
    if (fn.length === 6) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2To(parameter2) {
                    return function fn3To(parameter3) {
                        return function fn4To(parameter4) {
                            return function fn5(parameter5) {
                                return fn(parameter0, parameter1, parameter2, parameter3, parameter4, parameter5);
                            };
                        };
                    };
                };
            };
        };
    }
    if (fn.length === 7) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2To(parameter2) {
                    return function fn3To(parameter3) {
                        return function fn4To(parameter4) {
                            return function fn5To(parameter5) {
                                return function fn6(parameter6) {
                                    return fn(parameter0, parameter1, parameter2, parameter3, parameter4, parameter5, parameter6);
                                };
                            };
                        };
                    };
                };
            };
        };
    }
    if (fn.length === 8) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2To(parameter2) {
                    return function fn3To(parameter3) {
                        return function fn4To(parameter4) {
                            return function fn5To(parameter5) {
                                return function fn6To(parameter6) {
                                    return function fn7(parameter7) {
                                        return fn(parameter0, parameter1, parameter2, parameter3, parameter4, parameter5, parameter6, parameter7);
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    }
    if (fn.length === 9) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2To(parameter2) {
                    return function fn3To(parameter3) {
                        return function fn4To(parameter4) {
                            return function fn5To(parameter5) {
                                return function fn6To(parameter6) {
                                    return function fn7To(parameter7) {
                                        return function fn8(parameter8) {
                                            return fn(parameter0, parameter1, parameter2, parameter3, parameter4, parameter5, parameter6, parameter7, parameter8);
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    }
    if (fn.length === 10) {
        return function fn0To(parameter0) {
            return function fn1To(parameter1) {
                return function fn2To(parameter2) {
                    return function fn3To(parameter3) {
                        return function fn4To(parameter4) {
                            return function fn5To(parameter5) {
                                return function fn6To(parameter6) {
                                    return function fn7To(parameter7) {
                                        return function fn8To(parameter8) {
                                            return function fn9(parameter9) {
                                                return fn(parameter0, parameter1, parameter2, parameter3, parameter4, parameter5, parameter6, parameter7, parameter8, parameter9);
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    }
    throw new RangeError("unsupported fn length ".concat(fn.length));
}
