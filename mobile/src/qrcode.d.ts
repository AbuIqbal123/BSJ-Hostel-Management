declare module "qrcode" {
  export function create(
    value: string,
    options: { errorCorrectionLevel: "L" | "M" | "Q" | "H" },
  ): {
    modules: {
      size: number;
      data: ArrayLike<number>;
    };
  };
}
