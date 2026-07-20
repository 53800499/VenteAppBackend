export interface FxRateFraction {
  numerator: number;
  denominator: number;
}

export interface FxRatePair {
  buy: FxRateFraction;
  sell: FxRateFraction;
}

export class FxCalculationService {
  /** Client achète devise étrangère (apporte FCFA). Taux vente appliqué. */
  computeForeignFromFcfa(
    fcfaAmount: number,
    sellRate: FxRateFraction,
  ): number {
    return Math.floor(
      (fcfaAmount * sellRate.denominator) / sellRate.numerator,
    );
  }

  /** Client vend devise étrangère (repart avec FCFA). Taux achat appliqué. */
  computeFcfaFromForeign(
    foreignAmount: number,
    buyRate: FxRateFraction,
  ): number {
    return Math.floor(
      (foreignAmount * buyRate.numerator) / buyRate.denominator,
    );
  }

  /** Marge estimée pour une vente de devise (client apporte FCFA). */
  computeSellMarginFcfa(
    fcfaReceived: number,
    foreignDelivered: number,
    buyRate: FxRateFraction,
  ): number {
    const costAtBuyRate = this.computeFcfaFromForeign(
      foreignDelivered,
      buyRate,
    );
    return fcfaReceived - costAtBuyRate;
  }

  /** Marge estimée pour un achat de devise (client apporte devise étrangère). */
  computeBuyMarginFcfa(
    foreignReceived: number,
    fcfaPaid: number,
    sellRate: FxRateFraction,
  ): number {
    const revenueAtSellRate = this.computeFcfaFromForeign(
      foreignReceived,
      {
        numerator: sellRate.numerator,
        denominator: sellRate.denominator,
      },
    );
    return revenueAtSellRate - fcfaPaid;
  }

  formatRateLabel(
    quoteCurrency: string,
    rate: FxRateFraction,
  ): string {
    return `${rate.denominator.toLocaleString('fr-FR')} ${quoteCurrency} = ${rate.numerator.toLocaleString('fr-FR')} FCFA`;
  }
}
