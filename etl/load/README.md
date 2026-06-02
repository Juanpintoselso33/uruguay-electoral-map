# etl/load

Emisión de los *shards* JSON finales que sirve la app bajo [`public/data/`](../../public/data/README.md).

| Archivo | Función |
|---------|---------|
| `emit-shard.ts` | Arma un `VotosShard` a partir de los agregados, lo **valida contra el contrato** (`src/lib/contracts`) y lo escribe a disco. |

La validación contra el contrato (`assertVotosShard`) garantiza que ningún shard malformado llegue a `public/data/`. Los tipos del shard (`VotosShard`, `EleccionTipo`, `NivelGeografico`) viven en [`src/lib/contracts/`](../../src/lib/contracts/README.md).
