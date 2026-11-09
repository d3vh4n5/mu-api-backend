import {
  baseClassOf,
  classNameOf,
  computeResetPoints,
  effectiveAccountLevel,
  mapNameOf,
  rulesFor,
} from './game-rules';

describe('game-rules', () => {
  describe('baseClassOf', () => {
    it.each([
      [0, 0],
      [1, 0],
      [16, 1],
      [17, 1],
      [32, 2],
      [33, 2],
      [48, 3],
      [64, 4],
      [null, 0],
    ])('class %p -> base %p', (code, base) => {
      expect(baseClassOf(code)).toBe(base);
    });
  });

  it('classNameOf devuelve nombre de evolución', () => {
    expect(classNameOf(17)).toBe('Blade Knight');
    expect(classNameOf(64)).toBe('Dark Lord');
  });

  it('mapNameOf resuelve mapas de eventos', () => {
    expect(mapNameOf(0)).toBe('Lorencia');
    expect(mapNameOf(11)).toBe('Blood Castle 1');
    expect(mapNameOf(19)).toBe('Chaos Castle 2');
    expect(mapNameOf(99)).toBe('Mapa 99');
  });

  describe('effectiveAccountLevel', () => {
    const now = new Date('2026-11-09T00:00:00Z');

    it('VIP vigente mantiene su nivel', () => {
      expect(
        effectiveAccountLevel(2, new Date('2026-12-01T00:00:00Z'), now),
      ).toBe(2);
    });

    it('VIP vencido vuelve a FREE', () => {
      expect(
        effectiveAccountLevel(3, new Date('2026-10-01T00:00:00Z'), now),
      ).toBe(0);
    });

    it('niveles inválidos son FREE', () => {
      expect(effectiveAccountLevel(7, new Date('2030-01-01'), now)).toBe(0);
      expect(effectiveAccountLevel(null, null, now)).toBe(0);
    });
  });

  it('rulesFor usa los valores del servidor por nivel de cuenta', () => {
    expect(rulesFor(0)).toMatchObject({
      resetLevel: 400,
      resetMoney: 5_000_000,
      resetPoint: 400,
      pkClearMoney: 5_000_000,
    });
    expect(rulesFor(3)).toMatchObject({
      resetLevel: 350,
      resetMoney: 1_000_000,
      resetPoint: 800,
      pkClearMoney: 500_000,
    });
  });

  describe('computeResetPoints', () => {
    it('acumula puntos por cantidad de resets', () => {
      expect(
        computeResetPoints({ resets: 1, resetPoint: 400, baseClass: 1 }),
      ).toBe(400);
      expect(
        computeResetPoints({ resets: 10, resetPoint: 800, baseClass: 4 }),
      ).toBe(8000);
    });

    it('suma los puntos de frutas', () => {
      expect(
        computeResetPoints({
          resets: 2,
          resetPoint: 400,
          baseClass: 0,
          fruitAddPoint: 30,
        }),
      ).toBe(830);
    });
  });
});
