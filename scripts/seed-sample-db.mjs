#!/usr/bin/env node
// Generates fixtures/sample.db: a small relational dataset (customers,
// products, orders, order_items + a view) for manually testing sqlito
// against a normal schema instead of the synthetic bench db.

import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(repoRoot, 'fixtures/sample.db');

mkdirSync(dirname(dbPath), { recursive: true });
try { unlinkSync(dbPath); } catch {}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE customers (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE products (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL,
    price    REAL NOT NULL,
    stock    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE orders (
    id          INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status      TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
    created_at  TEXT NOT NULL
  );

  CREATE TABLE order_items (
    id         INTEGER PRIMARY KEY,
    order_id   INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL,
    unit_price REAL NOT NULL
  );

  CREATE INDEX idx_orders_customer_id ON orders(customer_id);
  CREATE INDEX idx_order_items_order_id ON order_items(order_id);
  CREATE INDEX idx_order_items_product_id ON order_items(product_id);

  CREATE VIEW order_totals AS
    SELECT order_id, SUM(quantity * unit_price) AS total
    FROM order_items
    GROUP BY order_id;
`);

const customers = [
  ['Ana García', 'ana.garcia@example.com', '2025-11-02'],
  ['Luis Fernández', 'luis.fernandez@example.com', '2025-11-05'],
  ['Marta López', 'marta.lopez@example.com', '2025-11-09'],
  ['Carlos Ruiz', 'carlos.ruiz@example.com', '2025-11-14'],
  ['Elena Torres', 'elena.torres@example.com', '2025-11-20'],
  ['Javier Molina', 'javier.molina@example.com', '2025-12-01'],
  ['Sara Díaz', 'sara.diaz@example.com', '2025-12-06'],
  ['Pablo Navarro', 'pablo.navarro@example.com', '2025-12-10'],
  ['Lucía Romero', 'lucia.romero@example.com', '2025-12-15'],
  ['Diego Santos', 'diego.santos@example.com', '2025-12-22'],
];

const products = [
  ['Teclado mecánico', 'Periféricos', 79.99, 40],
  ['Ratón inalámbrico', 'Periféricos', 29.99, 65],
  ['Monitor 27"', 'Monitores', 219.0, 15],
  ['Auriculares Bluetooth', 'Audio', 59.9, 30],
  ['Webcam HD', 'Periféricos', 45.5, 22],
  ['SSD 1TB', 'Almacenamiento', 89.0, 50],
  ['Disco duro 4TB', 'Almacenamiento', 109.0, 18],
  ['Router WiFi 6', 'Redes', 129.99, 12],
  ['Cargador USB-C 65W', 'Accesorios', 24.99, 80],
  ['Silla ergonómica', 'Mobiliario', 189.0, 8],
  ['Lámpara LED escritorio', 'Mobiliario', 34.9, 25],
  ['Hub USB-C 7 puertos', 'Accesorios', 39.95, 33],
];

// [customerId, status, date, [[productId, qty], ...]]
const orders = [
  [1, 'paid', '2025-11-03', [[1, 1], [2, 1]]],
  [2, 'paid', '2025-11-06', [[3, 1]]],
  [1, 'shipped', '2025-11-10', [[6, 2], [9, 1]]],
  [3, 'pending', '2025-11-12', [[10, 1], [11, 1]]],
  [4, 'paid', '2025-11-15', [[4, 1]]],
  [5, 'cancelled', '2025-11-18', [[7, 1]]],
  [2, 'shipped', '2025-11-21', [[12, 2]]],
  [6, 'paid', '2025-12-02', [[1, 1], [5, 1], [9, 2]]],
  [7, 'pending', '2025-12-07', [[8, 1]]],
  [3, 'paid', '2025-12-08', [[2, 3]]],
  [8, 'shipped', '2025-12-11', [[3, 1], [11, 1]]],
  [9, 'paid', '2025-12-16', [[6, 1], [7, 1]]],
  [4, 'paid', '2025-12-18', [[9, 1], [12, 1]]],
  [10, 'pending', '2025-12-23', [[4, 2]]],
  [6, 'paid', '2025-12-27', [[1, 1], [2, 1], [5, 1]]],
];

const insertCustomer = db.prepare(
  'INSERT INTO customers (name, email, created_at) VALUES (?, ?, ?)',
);
const insertProduct = db.prepare(
  'INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)',
);
const insertOrder = db.prepare(
  'INSERT INTO orders (customer_id, status, created_at) VALUES (?, ?, ?)',
);
const insertOrderItem = db.prepare(
  'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
);
const priceOf = db.prepare('SELECT price FROM products WHERE id = ?');

const seed = db.transaction(() => {
  for (const c of customers) insertCustomer.run(...c);
  for (const p of products) insertProduct.run(...p);
  for (const [customerId, status, date, items] of orders) {
    const { lastInsertRowid: orderId } = insertOrder.run(customerId, status, date);
    for (const [productId, qty] of items) {
      const { price } = priceOf.get(productId);
      insertOrderItem.run(orderId, productId, qty, price);
    }
  }
});

seed();
db.close();

console.log(`fixtures/sample.db creada: ${customers.length} customers, ${products.length} products, ${orders.length} orders`);
