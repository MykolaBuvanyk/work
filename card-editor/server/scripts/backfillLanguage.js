// One-time script: derive `language` for existing Users and Orders from their saved `country`.
// Run once on the server after deploying the i18n feature:
//   node server/scripts/backfillLanguage.js
//
// Safe to re-run: it only touches rows whose `language` is still the default 'de' (or null).

import 'dotenv/config';
import sequelize from '../db.js';
import { User, Order } from '../models/models.js';
import { countryToLanguage, DEFAULT_LANGUAGE } from '../i18n/index.js';

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected.');

    // 1) Users
    const users = await User.findAll();
    let userUpdated = 0;
    let userSkipped = 0;
    for (const user of users) {
      const target = countryToLanguage(user.country);
      const current = user.language || DEFAULT_LANGUAGE;
      // skip if already matches expected
      if (current === target) { userSkipped++; continue; }
      // only auto-fix rows that are still the default (don't clobber custom choices)
      if (current === DEFAULT_LANGUAGE) {
        user.language = target;
        await user.save();
        userUpdated++;
      } else {
        userSkipped++;
      }
    }
    console.log(`Users: updated=${userUpdated}, skipped=${userSkipped}, total=${users.length}`);

    // 2) Orders — snapshot from country (since language wasn't stored historically)
    const orders = await Order.findAll();
    let orderUpdated = 0;
    let orderSkipped = 0;
    for (const order of orders) {
      const target = countryToLanguage(order.country);
      const current = order.language || DEFAULT_LANGUAGE;
      if (current === target) { orderSkipped++; continue; }
      if (current === DEFAULT_LANGUAGE) {
        order.language = target;
        await order.save();
        orderUpdated++;
      } else {
        orderSkipped++;
      }
    }
    console.log(`Orders: updated=${orderUpdated}, skipped=${orderSkipped}, total=${orders.length}`);

    console.log('Backfill done.');
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
};

run();
