/**
 * Migraciones SQL versionadas. Solo hacia adelante: para cambiar el esquema se agrega
 * una nueva entrada al final del array, nunca se modifica una migración ya aplicada.
 */
export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: "001_core",
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );

      -- Solo se guarda el hash SHA-256 del token de sesión, nunca el token.
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Ventanas de rate limit de la API de Ninox, persistidas para sobrevivir reinicios.
      CREATE TABLE api_rate_buckets (
        bucket TEXT PRIMARY KEY,
        next_allowed_at INTEGER NOT NULL,
        last_request_at INTEGER,
        last_status INTEGER
      );
    `
  },
  {
    id: 2,
    name: "002_catalog",
    sql: `
      CREATE TABLE articulos (
        articulo_id INTEGER PRIMARY KEY,
        codigo TEXT NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        descripcion_web TEXT,
        talle_color INTEGER NOT NULL DEFAULT 0,
        -- Precio de la lista configurada en la integración (precioVenta, o precio1 si no viene).
        precio_venta REAL,
        precio1 REAL, precio2 REAL, precio3 REAL, precio4 REAL, precio5 REAL,
        stock_total REAL NOT NULL DEFAULT 0,
        imagen TEXT,
        eliminado INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT,
        synced_at TEXT NOT NULL
      );
      CREATE INDEX idx_articulos_codigo ON articulos(codigo);

      CREATE TABLE articulo_variantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        articulo_id INTEGER NOT NULL REFERENCES articulos(articulo_id) ON DELETE CASCADE,
        color_id INTEGER,
        talle_id INTEGER,
        color_nombre TEXT,
        color_codigo TEXT,
        color_hex TEXT,
        talle_nombre TEXT,
        talle_codigo TEXT,
        codigo_barras TEXT,
        unidades REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_variantes_articulo ON articulo_variantes(articulo_id);

      -- tipo: 0 TAG, 1 CATEGORIA, 2 MARCA, 3 TEMPORADA
      CREATE TABLE tags (
        tag_id INTEGER PRIMARY KEY,
        tipo INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        padre_id INTEGER
      );

      CREATE TABLE articulo_tags (
        articulo_id INTEGER NOT NULL REFERENCES articulos(articulo_id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
        PRIMARY KEY (articulo_id, tag_id)
      );

      CREATE TABLE catalog_sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger TEXT NOT NULL,
        status TEXT NOT NULL,
        articulos INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );
    `
  },
  {
    id: 3,
    name: "003_orders",
    sql: `
      -- Reservas (preventas) y ventas enviadas a Ninox desde esta app.
      -- orden_id es la clave de idempotencia que viaja a Ninox.
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('preventa', 'venta')),
        orden_id INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('pending', 'created', 'failed', 'unknown', 'cancelled')),
        factura_id INTEGER,
        cliente_nombre TEXT,
        total REAL NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        response_json TEXT,
        error TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_orders_status ON orders(kind, status);
    `
  },
  {
    id: 4,
    name: "004_ingest",
    sql: `
      CREATE TABLE ingest_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        sucursal_id INTEGER,
        periodo TEXT,
        params_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
        page INTEGER NOT NULL DEFAULT 0,
        total_pages INTEGER,
        rows INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE INDEX idx_ingest_jobs_status ON ingest_jobs(status);

      -- Páginas descargadas de un job en curso. Se vuelcan a la tabla destino al terminar.
      CREATE TABLE ingest_staging (
        job_id INTEGER NOT NULL REFERENCES ingest_jobs(id) ON DELETE CASCADE,
        page INTEGER NOT NULL,
        row_json TEXT NOT NULL
      );
      CREATE INDEX idx_ingest_staging_job ON ingest_staging(job_id, page);

      -- periodo = 'YYYY-MM' del job que importó la fila. Junto con sucursal_id define
      -- el alcance que se reemplaza al reimportar (las exportaciones no traen id de línea).
      CREATE TABLE ventas_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        comprobante_tipo INTEGER NOT NULL,
        tipo_documento INTEGER,
        fecha TEXT,
        fecha_text TEXT NOT NULL,
        hora_text TEXT,
        numero_full TEXT,
        sucursal_id INTEGER NOT NULL,
        sucursal TEXT,
        app_id INTEGER,
        cliente TEXT,
        vendedor TEXT,
        detalle TEXT,
        codigo TEXT,
        descripcion TEXT,
        talle TEXT,
        color TEXT,
        cantidad REAL NOT NULL DEFAULT 0,
        costo_item REAL,
        costo_articulo REAL,
        precio_venta REAL,
        precio_venta_final REAL,
        precio_lista1 REAL,
        precio_lista2 REAL,
        periodo TEXT NOT NULL,
        job_id INTEGER
      );
      CREATE INDEX idx_ventas_items_scope ON ventas_items(sucursal_id, periodo);
      CREATE INDEX idx_ventas_items_fecha ON ventas_items(fecha_text);
      CREATE INDEX idx_ventas_items_factura ON ventas_items(factura_id);
      CREATE INDEX idx_ventas_items_codigo ON ventas_items(codigo);

      CREATE TABLE ventas_totales (
        factura_id INTEGER PRIMARY KEY,
        comprobante_tipo INTEGER NOT NULL,
        tipo_documento INTEGER,
        fecha TEXT,
        fecha_text TEXT NOT NULL,
        hora_text TEXT,
        numero_full TEXT,
        sucursal_id INTEGER NOT NULL,
        sucursal TEXT,
        app_id INTEGER,
        cliente TEXT,
        vendedor TEXT,
        email TEXT,
        dni TEXT,
        detalle TEXT,
        sub_total REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        descuento REAL NOT NULL DEFAULT 0,
        recargo REAL NOT NULL DEFAULT 0,
        iva REAL NOT NULL DEFAULT 0,
        impuestos_total REAL NOT NULL DEFAULT 0,
        cantidad REAL NOT NULL DEFAULT 0,
        formas_pago_text TEXT,
        periodo TEXT NOT NULL,
        job_id INTEGER
      );
      CREATE INDEX idx_ventas_totales_scope ON ventas_totales(sucursal_id, periodo);
      CREATE INDEX idx_ventas_totales_fecha ON ventas_totales(fecha_text);

      CREATE TABLE ventas_formas_pago (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        tipo INTEGER NOT NULL,
        tipo_text TEXT,
        detalle TEXT,
        importe REAL NOT NULL DEFAULT 0,
        sucursal_id INTEGER NOT NULL,
        periodo TEXT NOT NULL,
        job_id INTEGER
      );
      CREATE INDEX idx_ventas_fp_scope ON ventas_formas_pago(sucursal_id, periodo);
      CREATE INDEX idx_ventas_fp_factura ON ventas_formas_pago(factura_id);

      CREATE TABLE compras_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        comprobante_tipo INTEGER NOT NULL,
        tipo_documento INTEGER,
        fecha TEXT,
        fecha_text TEXT NOT NULL,
        hora_text TEXT,
        numero_full TEXT,
        sucursal_id INTEGER NOT NULL,
        sucursal TEXT,
        deposito_id INTEGER,
        app_id INTEGER,
        proveedor TEXT,
        empleado TEXT,
        detalle TEXT,
        codigo TEXT,
        descripcion TEXT,
        talle TEXT,
        color TEXT,
        lote TEXT,
        cantidad REAL NOT NULL DEFAULT 0,
        costo_item REAL,
        costo_articulo REAL,
        precio_compra REAL,
        precio_compra_final REAL,
        periodo TEXT NOT NULL,
        job_id INTEGER
      );
      CREATE INDEX idx_compras_items_scope ON compras_items(sucursal_id, periodo);
      CREATE INDEX idx_compras_items_fecha ON compras_items(fecha_text);
      CREATE INDEX idx_compras_items_codigo ON compras_items(codigo);

      CREATE TABLE compras_totales (
        factura_id INTEGER PRIMARY KEY,
        comprobante_tipo INTEGER NOT NULL,
        tipo_documento INTEGER,
        fecha TEXT,
        fecha_text TEXT NOT NULL,
        hora_text TEXT,
        numero_full TEXT,
        sucursal_id INTEGER NOT NULL,
        sucursal TEXT,
        app_id INTEGER,
        proveedor TEXT,
        empleado TEXT,
        detalle TEXT,
        sub_total REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        descuento REAL NOT NULL DEFAULT 0,
        recargo REAL NOT NULL DEFAULT 0,
        iva REAL NOT NULL DEFAULT 0,
        impuestos_total REAL NOT NULL DEFAULT 0,
        cantidad REAL NOT NULL DEFAULT 0,
        formas_pago_text TEXT,
        periodo TEXT NOT NULL,
        job_id INTEGER
      );
      CREATE INDEX idx_compras_totales_scope ON compras_totales(sucursal_id, periodo);
      CREATE INDEX idx_compras_totales_fecha ON compras_totales(fecha_text);

      CREATE TABLE compras_formas_pago (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        tipo INTEGER NOT NULL,
        tipo_text TEXT,
        detalle TEXT,
        importe REAL NOT NULL DEFAULT 0,
        sucursal_id INTEGER NOT NULL,
        periodo TEXT NOT NULL,
        job_id INTEGER
      );
      CREATE INDEX idx_compras_fp_scope ON compras_formas_pago(sucursal_id, periodo);
    `
  },
  {
    id: 5,
    name: "005_ingest_prepared",
    sql: `
      -- Preparado para la próxima etapa: snapshots de stock por depósito (exportar/stock).
      CREATE TABLE stock_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deposito_id INTEGER NOT NULL,
        registros INTEGER NOT NULL DEFAULT 0,
        taken_at TEXT NOT NULL,
        job_id INTEGER
      );

      CREATE TABLE stock_snapshot_items (
        snapshot_id INTEGER NOT NULL REFERENCES stock_snapshots(id) ON DELETE CASCADE,
        articulo_id INTEGER,
        codigo TEXT,
        descripcion TEXT,
        sucursal_id INTEGER,
        deposito_id INTEGER,
        color_id INTEGER,
        color_nombre TEXT,
        talle_id INTEGER,
        talle_nombre TEXT,
        cantidad REAL NOT NULL DEFAULT 0,
        reservado REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_stock_items_snapshot ON stock_snapshot_items(snapshot_id);

      -- Preparado para la próxima etapa: saldos vencidos de clientes y proveedores.
      CREATE TABLE saldos_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL CHECK (tipo IN ('cliente', 'proveedor')),
        sucursal_id INTEGER,
        saldo_total REAL NOT NULL DEFAULT 0,
        registros INTEGER NOT NULL DEFAULT 0,
        taken_at TEXT NOT NULL,
        job_id INTEGER
      );

      CREATE TABLE saldos_items (
        snapshot_id INTEGER NOT NULL REFERENCES saldos_snapshots(id) ON DELETE CASCADE,
        entidad_id INTEGER NOT NULL,
        nombre TEXT,
        razon_social TEXT,
        saldo REAL NOT NULL DEFAULT 0,
        saldo15 REAL NOT NULL DEFAULT 0,
        saldo30 REAL NOT NULL DEFAULT 0,
        saldo60 REAL NOT NULL DEFAULT 0,
        saldo90 REAL NOT NULL DEFAULT 0,
        saldo90_mas REAL NOT NULL DEFAULT 0,
        cantidad_facturas INTEGER NOT NULL DEFAULT 0,
        total_ultimo_pago REAL,
        fecha_ultimo_pago TEXT
      );
      CREATE INDEX idx_saldos_items_snapshot ON saldos_items(snapshot_id);
    `
  }
];
