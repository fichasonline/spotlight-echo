-- ============================================================================
-- Más monedas para los premios de campeones.
--
-- El CHECK original sólo aceptaba ('UYU','USD'), que alcanzaba cuando la
-- cobertura era local. El circuito es regional: hay premios en reales,
-- guaraníes, soles y euros.
--
-- Se reemplaza el CHECK por la lista completa en lugar de sacarlo: sigue
-- atajando un typo ('BRLL') antes de que entre a la base. La lista tiene que
-- coincidir con src/lib/currencies.ts.
-- ============================================================================

ALTER TABLE public.champions
  DROP CONSTRAINT IF EXISTS champions_currency_check;

ALTER TABLE public.champions
  ADD CONSTRAINT champions_currency_check
  CHECK (currency IN (
    'UYU', 'USD', 'ARS', 'BRL', 'CLP', 'PYG', 'BOB',
    'PEN', 'COP', 'MXN', 'CRC', 'DOP', 'EUR', 'GBP'
  ));
