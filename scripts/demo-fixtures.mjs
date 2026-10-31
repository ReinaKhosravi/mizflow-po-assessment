// Stable IDs make the development seed idempotent. No credentials in fixtures.
export const cafes = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    branch: "11000000-0000-4000-8000-000000000001",
    slug: "demo-narvan",
    name: "کافه نارون",
    branchName: "شعبه ولیعصر",
    prefix: "narvan",
    tableCount: 12,
  },
  {
    id: "20000000-0000-4000-8000-000000000001",
    branch: "21000000-0000-4000-8000-000000000001",
    slug: "demo-rooz",
    name: "کافه روز",
    branchName: "شعبه کریم‌خان",
    prefix: "rooz",
    tableCount: 8,
  },
];
export const menu = [
  ["اسپرسو دبل", "قهوه گرم", "دو شات قهوه تازه", 850000],
  ["لاته", "قهوه گرم", "اسپرسو با شیر بخارداده‌شده", 1250000],
  ["چای ایرانی", "چای و دمنوش", "چای لاهیجان همراه نبات", 650000],
  ["کیک هویج و گردو", "کیک و دسر", "یک برش کیک روز", 1450000],
  ["لیموناد تازه", "نوشیدنی سرد", "لیموترش، نعناع و آب گازدار", 1100000],
  ["پنینی مرغ", "غذای سبک", "مرغ گریل و پنیر", 2450000],
  ["آمریکانو", "قهوه گرم", "اسپرسو دبل با آب داغ", 950000],
  ["کاپوچینو", "قهوه گرم", "اسپرسو با شیر و کف غلیظ", 1200000],
  ["موکا", "قهوه گرم", "اسپرسو، شکلات تلخ و شیر", 1500000],
  ["دمنوش به‌لیمو", "چای و دمنوش", "به‌لیمو دم‌کشیده همراه عسل", 850000],
  ["آیس‌لاته", "نوشیدنی سرد", "اسپرسو و شیر سرد روی یخ", 1350000],
  ["چیزکیک زعفرانی", "کیک و دسر", "چیزکیک با عطر زعفران و پسته", 1650000],
];
// Separate branch menus, preserving original snapshot rows on repeated imports.
export function cafeMenu(index) {
  return index === 0
    ? menu
    : menu.map(([name, category, description, price], n) => [
        n === 5 ? "پنینی سبزیجات" : name,
        category,
        n === 5 ? "قارچ، فلفل دلمه‌ای و پنیر گریل‌شده" : description,
        price + 50000,
      ]);
}
export function fixtureId(cafeIndex, kind, n) {
  return `${cafeIndex + 1}${kind}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}
export async function insertCafeData(db, cafe, index, users) {
  await db.query(
    "insert into public.restaurants(id,name,slug) values($1,$2,$3) on conflict(id) do nothing",
    [cafe.id, cafe.name, cafe.slug],
  );
  await db.query(
    "insert into public.branches(id,restaurant_id,name) values($1,$2,$3) on conflict(id) do nothing",
    [cafe.branch, cafe.id, cafe.branchName],
  );
  for (const role of ["owner", "waiter", "kitchen"]) {
    await db.query(
      `insert into public.restaurant_memberships(restaurant_id,user_id,branch_id,role) values($1,$2,$3,$4)
      on conflict(restaurant_id,user_id) do nothing`,
      [cafe.id, users[role], role === "owner" ? null : cafe.branch, role],
    );
  }
  for (let n = 1; n <= cafe.tableCount; n++)
    await db.query(
      `insert into public.dining_tables(id,restaurant_id,branch_id,label,seats) values($1,$2,$3,$4,$5) on conflict(id) do nothing`,
      [
        fixtureId(index, 2, n),
        cafe.id,
        cafe.branch,
        new Intl.NumberFormat("fa-IR").format(n),
        n <= 8 ? 4 : 2,
      ],
    );
  for (const [n, item] of cafeMenu(index).entries())
    await db.query(
      `insert into public.menu_items(id,restaurant_id,branch_id,name,category,description,price_irr) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing`,
      [fixtureId(index, 3, n + 1), cafe.id, cafe.branch, ...item],
    );
  for (let n = 1; n <= 5; n++) {
    const orderId = fixtureId(index, 4, n),
      itemId = fixtureId(index, 5, n),
      at = n <= 2 ? `2026-10-${20 + n}T09:00:00Z` : `2026-10-31T18:${n}0:00Z`,
      status =
        n <= 2 ? "closed" : ["submitted", "in_preparation", "ready"][n - 3],
      itemStatus = n <= 2 ? "served" : ["queued", "preparing", "ready"][n - 3],
      version = n <= 2 ? 4 : n - 2;
    await db.query(
      `insert into public.orders(id,restaurant_id,branch_id,table_id,created_by,status,version,idempotency_key,created_at) values($1,$2,$3,$4,$5,$7,$8,$1,$6) on conflict(id) do nothing`,
      [
        orderId,
        cafe.id,
        cafe.branch,
        fixtureId(index, 2, n),
        users.waiter,
        at,
        status,
        version,
      ],
    );
    await db.query(
      `insert into public.order_items(id,restaurant_id,branch_id,order_id,menu_item_id,name_snapshot,unit_price_irr,quantity,status,version,idempotency_key,created_at,served_at,served_by) values($1,$2,$3,$4,$5,$6,$7,2,$9::public.order_item_status,$10,$1,$8,case when $9::public.order_item_status='served' then $8::timestamptz else null end,case when $9::public.order_item_status='served' then $11::uuid else null end) on conflict(id) do nothing`,
      [
        itemId,
        cafe.id,
        cafe.branch,
        orderId,
        fixtureId(index, 3, n),
        cafeMenu(index)[n - 1][0],
        cafeMenu(index)[n - 1][3],
        at,
        itemStatus,
        n <= 2 ? 3 : version,
        users.waiter,
      ],
    );
    await db.query(
      `insert into public.order_events(id,restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key,created_at) values($1,$2,$3,$4,$5,'demo_imported',$7,$1,$6) on conflict(id) do nothing`,
      [
        fixtureId(index, 6, n),
        cafe.id,
        cafe.branch,
        orderId,
        users.owner,
        at,
        version,
      ],
    );
  }
}
