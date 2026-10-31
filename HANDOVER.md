# MizFlow — handover for a café owner

Prepared by Reina Khosravi. A Persian staff guide is included in [HANDOVER.fa.md](HANDOVER.fa.md).

## What was delivered

Your floor team and kitchen share a Persian order board. They can see which table is waiting to order, what food is being prepared, what is ready, what a waiter has delivered and when the table becomes available again. The نارون demonstration has twelve numbered tables. Another fictional café has separate staff and records.

A manager can cover the waiter or kitchen job. Ordinary waiters and cooks still have different permissions. The manager's panel selector changes the working view; it does not sign in as a different employee.

The system stores orders and delivery history in a real database. It does not collect payments, apply discounts, manage stock or make AI recommendations.

## How staff can start a shift

1. **Sign in using your own role account.** Demo account details are supplied separately. A manager can choose پنل مدیر, پنل گارسون or پنل آشپزخانه from پنل کاری.
2. **Seat the guests.** Open میزها or ثبت سفارش, choose a free table and press **نشستن مهمان و ارائه منو**. The table is now occupied and waiting for an order; nothing has yet been sent to the kitchen.
3. **Take the order.** Choose items, quantities and any preparation notes. Press **ارسال به آشپزخانه** and wait for the server-confirmed message. Listed prices are toman.
4. **Prepare.** In آشپزخانه, use **شروع آماده‌سازی**, then **آماده شد**. Ready means ready for a waiter—not already delivered.
5. **Deliver.** On the table order, the waiter presses **سرو شد** for each ready line actually handed to the guests. The system records the account and time. That line leaves the kitchen queue, but remains in the order history.
6. **Take another round if needed.** Add drinks or dessert to the same occupied table. Earlier delivery records stay intact.
7. **Release the table after guests leave.** Use **آزاد کردن میز پس از خروج مهمان**, then confirm departure. The next party gets a new order. Do not use this as confirmation of payment; payment remains separate.

The hall filters show all, free, occupied and awaiting-order tables. Two-seat tables are round with two chairs; four-seat tables are rectangular with four chairs. The picture is a helpful arrangement, not a measured map of your actual room.

## If something goes wrong

- If the screen says the connection is lost, its displayed information may be old. Confirm the situation with the kitchen before promising delivery.
- If a result is uncertain, use the **بررسی دوباره** button. Do not repeatedly start new requests; the original request can be checked safely.
- A screen may say the order changed because another employee acted first. Read the refreshed state and try the appropriate next step.
- Unsent choices belong to the original party. If another employee releases/reseats the table, clear the old choices before ordering for the new guests.
- Unsent choices are not saved across refresh or closing the browser. Do not reload a draft expecting an offline order queue.
- If access is denied, ask the manager/administrator to check the account and branch assignment. Changing a view cannot grant access.

## Known limitations

This is a supervised first release, not a replacement for every tool in the café. Keep an agreed paper/communication fallback until your staff have rehearsed it with your actual devices and internet.

- There is no payment, discount, receipt, tax, inventory, supplier or AI feature.
- Staff invitations, password recovery and setup/configuration screens are not complete. Setup still needs a technical administrator.
- It needs connectivity. Display updates are periodic, not guaranteed instant messages; there is no durable offline queue or kitchen-printer integration.
- The kitchen shows the oldest 100 matching items and warns when there are more. Larger lists/orders need pagination before heavier service.
- Delivery is recorded for a whole line/quantity, not individual cups inside one line. Arbitrary cancellation, correction/undo and refunds are not provided.
- A shared demo may have historical sample activity. Imported history illustrates the restaurant; it is not proof of real customer adoption.
- Hosted security settings, monitoring, backup restoration and a separate independent security review are not claimed complete. The final whole-browser test run was interrupted when the product was frozen; see the verification report.
- Historical records remain in the database. A full customer-facing historical-order/reporting screen is not included.

## The next five things to build, in order

1. **A genuinely useful, bounded shift insight.** Finish the brief's missing AI capability using trustworthy shift numbers and a clearly labeled explanation that can fail without interrupting service. Do not start with purchasing recommendations from nonexistent stock data.
2. **A safer shift fallback and recovery path.** Make unsent drafts durable, improve recovery/operator guidance and test the café's real devices/network. Lost connectivity should not become lost staff intent.
3. **Corrections and service exceptions.** Add reviewed cancellation, partial delivery and undo flows with reasons and history. Real staff need to recover from mistakes without editing records informally.
4. **Owner setup and staff management.** Provide controlled onboarding, menu/table setup, invitations and branch assignment so a café does not depend on a developer for everyday administration.
5. **Operational confidence and larger service.** Add complete history/pagination, monitoring/alerts, backup restoration exercises and measured load tests. These matter before marketing a larger rollout.

These priorities deliberately exclude taking over payments or inventory until the first service workflow and its exceptions are dependable.

## Where this design reaches its limits

These are planning estimates, not tested capacity claims. Assume three active staff screens per restaurant, each polling approximately every four seconds before response time.

| Restaurants | What that means                                            | The first specific pressure                                                                                                                                                                             |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10          | Roughly 30 screens and up to 7.5 refresh requests/second   | A small database plan, network reliability, the 100-item kitchen limit and lack of alerts—not the number of logos in the system                                                                         |
| 1,000       | Roughly 3,000 screens and 750 refresh requests/second      | Repeated identity checks and database reads become expensive. Measure and replace frequent full refreshes with appropriately authorized change delivery; manage connections, indexes and history growth |
| 100,000     | Roughly 300,000 screens and 75,000 refresh requests/second | One shared polling/database/Auth path is not credible. Tenant placement, data partitioning, delivery infrastructure, disaster recovery and dedicated operations become necessary                        |

An order intentionally handles its changes one at a time. That helps protect a normal café table, but an unusually busy single order can still queue updates. We would measure that before redesigning it. Separate restaurants can operate in parallel; scaling limits do not justify weakening their separation.
