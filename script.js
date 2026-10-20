/* ==========================================================================
   Interactive Product Inventory & Analytics Dashboard
   JavaScript Capstone Mini Project  (Vanilla JS, ES6+)

   SCOPE NOTE: Everything lives inside one arrow-function IIFE below
   (an "Immediately Invoked Function Expression"). Variables declared inside
   it are LOCAL to that function, so nothing leaks into the global `window`
   object. 'use strict' makes JavaScript report common mistakes as errors.

   File sections:
     1. Constants & sample data
     2. Small helpers (formatting, rounding, messages)
     3. Persistence (localStorage)
     4. Business rules: category + validation
     5. Inventory operations: add / find / update / delete
     6. Search & filter
     7. Analytics (loops, break, continue)
     8. Tax & discount calculation
     9. Rendering (safe DOM)
    10. Event handlers
    11. Start-up
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CONSTANTS & SAMPLE DATA
     `const` is used by default: these values never get reassigned.
     ------------------------------------------------------------------------ */
  const BUDGET_LIMIT = 1000;          // Budget: price < 1000, Premium: price >= 1000
  const MAX_PRICE = 10000000;         // sanity limit for user input (₹1 crore)
  const MAX_NAME_LENGTH = 60;
  const REPORT_LINE_LIMIT = 10;       // reports stop after this many lines (uses break)
  const STORAGE_KEY = 'inventoryDashboard.products.v1';

  const SAMPLE_PRODUCTS = [
    { id: 1, name: 'Wireless Mouse',              price: 799,   category: 'Budget'  },
    { id: 2, name: 'USB-C Cable',                 price: 349,   category: 'Budget'  },
    { id: 3, name: 'Phone Stand',                 price: 499,   category: 'Budget'  },
    { id: 4, name: 'Laptop Sleeve',               price: 999,   category: 'Budget'  },
    { id: 5, name: 'Bluetooth Speaker',           price: 1000,  category: 'Premium' },
    { id: 6, name: 'Mechanical Keyboard',         price: 2499,  category: 'Premium' },
    { id: 7, name: 'Noise-Cancelling Headphones', price: 5999,  category: 'Premium' },
    { id: 8, name: '27-inch Monitor',             price: 15999, category: 'Premium' }
  ];

  // Intl.NumberFormat with the en-IN locale gives Indian digit grouping (1,00,000).
  const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  /* ------------------------------------------------------------------------
     STATE
     `products` is the single source of truth. It uses `let` because it is
     re-assigned (after delete / reset). `filters` is a const object whose
     properties change (the object itself is never replaced).
     ------------------------------------------------------------------------ */
  let products = [];
  const filters = { query: '', category: 'All' };
  let messageTimer = null;

  /* ------------------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);   // arrow function helper

  const el = {
    message: $('message'),
    statTotal: $('statTotal'),
    statValue: $('statValue'),
    statAverage: $('statAverage'),
    statBudget: $('statBudget'),
    statPremium: $('statPremium'),
    productForm: $('productForm'),
    editId: $('editId'),
    productName: $('productName'),
    productPrice: $('productPrice'),
    submitBtn: $('submitBtn'),
    cancelEditBtn: $('cancelEditBtn'),
    promptBtn: $('promptBtn'),
    resetBtn: $('resetBtn'),
    thresholdHint: $('thresholdHint'),
    thresholdHint2: $('thresholdHint2'),
    searchInput: $('searchInput'),
    categoryFilter: $('categoryFilter'),
    resultCount: $('resultCount'),
    productBody: $('productBody'),
    emptyState: $('emptyState'),
    calcForm: $('calcForm'),
    calcProduct: $('calcProduct'),
    discountRate: $('discountRate'),
    taxRate: $('taxRate'),
    calcError: $('calcError'),
    calcResult: $('calcResult'),
    resOriginal: $('resOriginal'),
    resDiscount: $('resDiscount'),
    resDiscounted: $('resDiscounted'),
    resTax: $('resTax'),
    resFinal: $('resFinal'),
    insights: $('insights'),
    bars: $('bars'),
    reportType: $('reportType'),
    reportBtn: $('reportBtn'),
    reportOutput: $('reportOutput')
  };

  /* ------------------------------------------------------------------------
     2. SMALL HELPERS
     ------------------------------------------------------------------------ */
  const formatCurrency = (amount) => currencyFormatter.format(amount);

  // Avoids floating-point noise such as 0.1 + 0.2 = 0.30000000000000004
  const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

  // Shows a success / error / info banner, then hides it after a few seconds.
  const showMessage = (text, type = 'info') => {
    el.message.textContent = text;               // textContent = safe, no HTML parsing
    el.message.className = `message ${type}`;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => el.message.classList.add('hidden'), 6000);
  };

  /* ------------------------------------------------------------------------
     3. PERSISTENCE (localStorage)
     ------------------------------------------------------------------------ */

  // Returns a fresh copy of the sample data so edits never change SAMPLE_PRODUCTS.
  const getSampleCopy = () => SAMPLE_PRODUCTS.map((product) => ({ ...product }));

  // Never trust data read from storage: check every field before using it.
  const isValidProduct = (item) => {
    return (
      item !== null &&
      typeof item === 'object' &&
      Number.isInteger(item.id) && item.id > 0 &&
      typeof item.name === 'string' && item.name.trim() !== '' && item.name.length <= MAX_NAME_LENGTH &&
      typeof item.price === 'number' && Number.isFinite(item.price) && item.price > 0 && item.price <= MAX_PRICE
    );
  };

  function loadProducts() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) {
        return getSampleCopy();                   // first visit: use sample data
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        return getSampleCopy();
      }
      const cleaned = [];
      const seenIds = new Set();
      for (const item of parsed) {
        if (!isValidProduct(item) || seenIds.has(item.id)) {
          continue;                               // skip malformed or duplicate-ID records
        }
        seenIds.add(item.id);
        // Re-derive the category so stored data can never disagree with the rule.
        cleaned.push({ id: item.id, name: item.name.trim(), price: item.price, category: getCategoryByPrice(item.price) });
      }
      return cleaned;                             // may legitimately be an empty list
    } catch (error) {
      // Corrupted JSON or storage blocked (e.g. private mode)
      return getSampleCopy();
    }
  }

  // Returns true when saved, false when storage is unavailable.
  function saveProducts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      return true;
    } catch (error) {
      return false;
    }
  }

  const SAVE_WARNING = ' (Warning: could not save to browser storage, changes will be lost on refresh.)';

  /* ------------------------------------------------------------------------
     4. BUSINESS RULES: CATEGORY + VALIDATION
     ------------------------------------------------------------------------ */

  // Dedicated classification function using if...else.
  // Change BUDGET_LIMIT above to change the rule everywhere in the app.
  function getCategoryByPrice(price) {
    if (price < BUDGET_LIMIT) {
      return 'Budget';       // 999.99 -> Budget
    } else {
      return 'Premium';      // 1000 and above -> Premium
    }
  }

  // Each validator returns { valid, value } or { valid: false, error }.
  function validateProductName(rawName) {
    const name = String(rawName ?? '').trim();     // trim removes leading/trailing spaces
    if (name === '') {
      return { valid: false, error: 'Product name cannot be empty.' };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `Product name must be ${MAX_NAME_LENGTH} characters or fewer.` };
    }
    return { valid: true, value: name };
  }

  function validateProductPrice(rawPrice) {
    const text = String(rawPrice ?? '').trim();
    if (text === '') {
      return { valid: false, error: 'Price cannot be empty.' };
    }
    if (text.startsWith('-')) {
      return { valid: false, error: 'Price cannot be negative.' };
    }
    // Digits with up to two decimals only (blocks "abc", "1,000", "1e3", "0x10").
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
      return { valid: false, error: 'Price must be a number such as 799 or 1499.50 (no commas or symbols).' };
    }
    const price = Number(text);                    // explicit string -> number conversion
    if (!Number.isFinite(price) || price <= 0) {
      return { valid: false, error: 'Price must be greater than zero.' };
    }
    if (price > MAX_PRICE) {
      return { valid: false, error: `Price cannot exceed ${formatCurrency(MAX_PRICE)}.` };
    }
    return { valid: true, value: price };
  }

  /* ------------------------------------------------------------------------
     5. INVENTORY OPERATIONS
     ------------------------------------------------------------------------ */

  // Searches the array by ID. `break` stops the loop as soon as it is found.
  function findProductById(id) {
    let found = null;
    for (let i = 0; i < products.length; i++) {
      if (products[i].id === id) {
        found = products[i];
        break;               // BREAK EXAMPLE: no need to look at the remaining products
      }
    }
    return found;            // null when not found (missing / invalid ID handled safely)
  }

  // Uses a `while` loop to find the first ID that is not already taken.
  function generateUniqueId() {
    let candidate = products.length + 1;
    while (findProductById(candidate) !== null) {
      candidate++;
    }
    return candidate;
  }

  // SHARED creation logic: the on-page form AND the prompt() flow both call this.
  function addProduct(rawName, rawPrice) {
    const nameCheck = validateProductName(rawName);
    if (!nameCheck.valid) return { ok: false, error: nameCheck.error };

    const priceCheck = validateProductPrice(rawPrice);
    if (!priceCheck.valid) return { ok: false, error: priceCheck.error };

    const product = {
      id: generateUniqueId(),
      name: nameCheck.value,
      price: priceCheck.value,
      category: getCategoryByPrice(priceCheck.value)
    };
    products.push(product);
    return { ok: true, product, saved: saveProducts() };
  }

  function updateProduct(id, rawName, rawPrice) {
    const product = findProductById(id);
    if (product === null) return { ok: false, error: 'That product no longer exists.' };

    const nameCheck = validateProductName(rawName);
    if (!nameCheck.valid) return { ok: false, error: nameCheck.error };

    const priceCheck = validateProductPrice(rawPrice);
    if (!priceCheck.valid) return { ok: false, error: priceCheck.error };

    product.name = nameCheck.value;
    product.price = priceCheck.value;
    product.category = getCategoryByPrice(priceCheck.value);   // recalculated on edit
    return { ok: true, product, saved: saveProducts() };
  }

  function deleteProduct(id) {
    const product = findProductById(id);
    if (product === null) return { ok: false, error: 'Could not delete: product not found.' };
    products = products.filter((item) => item.id !== id);      // new array without the product
    return { ok: true, product, saved: saveProducts() };
  }

  /* ------------------------------------------------------------------------
     6. SEARCH & FILTER
     ------------------------------------------------------------------------ */

  // Case-insensitive name search using a for...of loop.
  function searchProducts(query, list = products) {
    const needle = query.trim().toLowerCase();
    if (needle === '') return list.slice();                    // empty search = everything
    const matches = [];
    for (const product of list) {
      if (product.name.toLowerCase().includes(needle)) {
        matches.push(product);
      }
    }
    return matches;
  }

  // Category filter using a `switch` statement to choose the rule (a real task).
  function filterProductsByCategory(category, list = products) {
    const result = [];
    for (const product of list) {
      let keep;
      switch (category) {
        case 'Budget':
          keep = product.category === 'Budget';
          break;
        case 'Premium':
          keep = product.category === 'Premium';
          break;
        case 'All':
        default:
          keep = true;
          break;
      }
      if (keep) result.push(product);
    }
    return result;
  }

  // Search AND category filter combined.
  const getVisibleProducts = () =>
    filterProductsByCategory(filters.category, searchProducts(filters.query));

  /* ------------------------------------------------------------------------
     7. ANALYTICS
     ------------------------------------------------------------------------ */

  function calculateTotalInventoryValue() {
    let total = 0;                                  // local accumulator
    for (let i = 0; i < products.length; i++) {
      if (!Number.isFinite(products[i].price)) {
        continue;            // CONTINUE EXAMPLE: skip an invalid record, move to the next one
      }
      total += products[i].price;
    }
    return roundToTwo(total);
  }

  const calculateAveragePrice = () =>
    products.length === 0 ? 0 : roundToTwo(calculateTotalInventoryValue() / products.length);

  function calculateCategoryCounts() {
    const counts = { Budget: 0, Premium: 0 };
    for (const product of products) {
      if (product.category === 'Budget') counts.Budget++;
      else if (product.category === 'Premium') counts.Premium++;
    }
    return counts;
  }

  // Returns { most, least } or nulls for an empty inventory.
  function findPriceExtremes() {
    if (products.length === 0) return { most: null, least: null };
    let most = products[0];
    let least = products[0];
    for (const product of products) {
      if (product.price > most.price) most = product;
      if (product.price < least.price) least = product;
    }
    return { most, least };
  }

  // Builds a text report. `switch` selects the report type (a real feature).
  function generateReport(type) {
    if (products.length === 0) {
      return 'Inventory is empty. Add products to generate a report.';
    }
    const lines = [];

    switch (type) {
      case 'budget':
      case 'premium': {
        const wanted = type === 'budget' ? 'Budget' : 'Premium';
        lines.push(`${wanted} products`, '------------------');
        let count = 0;
        for (const product of products) {
          if (!isValidProduct(product)) continue;          // CONTINUE: skip invalid records
          if (product.category !== wanted) continue;       // CONTINUE: skip other categories
          if (count >= REPORT_LINE_LIMIT) {
            lines.push('...list shortened to the first ' + REPORT_LINE_LIMIT + ' items.');
            break;                                         // BREAK: stop once the limit is reached
          }
          count++;
          lines.push(`${count}. ${product.name} - ${formatCurrency(product.price)}`);
        }
        if (count === 0) lines.push(`No ${wanted} products found.`);
        break;
      }
      case 'valid': {
        let checked = 0;
        let skipped = 0;
        for (const product of products) {
          checked++;
          if (!isValidProduct(product)) {
            skipped++;
            continue;                                      // CONTINUE: do not count bad records
          }
        }
        lines.push('Record check', '------------------',
          `Records checked: ${checked}`, `Valid records:   ${checked - skipped}`, `Skipped:         ${skipped}`);
        break;
      }
      case 'summary':
      default: {
        const counts = calculateCategoryCounts();
        const { most, least } = findPriceExtremes();
        lines.push('Inventory summary', '------------------',
          `Products:        ${products.length}`,
          `Total value:     ${formatCurrency(calculateTotalInventoryValue())}`,
          `Average price:   ${formatCurrency(calculateAveragePrice())}`,
          `Budget items:    ${counts.Budget}`,
          `Premium items:   ${counts.Premium}`,
          `Most expensive:  ${most.name} (${formatCurrency(most.price)})`,
          `Least expensive: ${least.name} (${formatCurrency(least.price)})`);
        break;
      }
    }
    return lines.join('\n');
  }

  /* ------------------------------------------------------------------------
     8. TAX & DISCOUNT CALCULATION
     All inputs arrive as parameters and all temporary values are LOCAL
     variables, so there are no globals and the stored price is never changed.
     ------------------------------------------------------------------------ */
  const calculateDiscountAmount = (price, discountRate) => roundToTwo((price * discountRate) / 100);
  const calculatePriceAfterDiscount = (price, discountRate) =>
    roundToTwo(price - calculateDiscountAmount(price, discountRate));
  const calculateTaxAmount = (price, taxRate) => roundToTwo((price * taxRate) / 100);
  const calculatePriceAfterTax = (price, taxRate) => roundToTwo(price + calculateTaxAmount(price, taxRate));

  // Order: discount first, then tax on the discounted price.
  function calculatePricing(originalPrice, discountRate, taxRate) {
    const discountAmount = calculateDiscountAmount(originalPrice, discountRate);
    const discountedPrice = calculatePriceAfterDiscount(originalPrice, discountRate);
    const taxAmount = calculateTaxAmount(discountedPrice, taxRate);
    const finalPrice = calculatePriceAfterTax(discountedPrice, taxRate);
    return { originalPrice, discountAmount, discountedPrice, taxAmount, finalPrice };
  }

  function parsePercentage(rawValue, label) {
    const text = String(rawValue ?? '').trim();
    if (text === '') return { valid: true, value: 0 };         // blank = 0%
    if (text.startsWith('-')) {
      return { valid: false, error: `${label} cannot be negative.` };
    }
    if (!/^\d+(\.\d+)?$/.test(text)) {
      return { valid: false, error: `${label} must be a number between 0 and 100.` };
    }
    const value = Number(text);
    if (value > 100) {
      return { valid: false, error: `${label} cannot be more than 100.` };
    }
    return { valid: true, value };
  }

  /* ------------------------------------------------------------------------
     9. RENDERING (safe DOM: createElement + textContent, never innerHTML)
     ------------------------------------------------------------------------ */
  function createCell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function createActionButton(label, className, action, product) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn-small ${className}`;
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = String(product.id);
    button.setAttribute('aria-label', `${label} ${product.name}`);
    return button;
  }

  function renderProducts() {
    const visible = getVisibleProducts();
    el.productBody.textContent = '';                           // clear old rows

    for (const product of visible) {
      const row = document.createElement('tr');
      row.appendChild(createCell(String(product.id)));
      row.appendChild(createCell(product.name));
      row.appendChild(createCell(formatCurrency(product.price)));

      const badgeCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${product.category.toLowerCase()}`;
      badge.textContent = product.category;
      badgeCell.appendChild(badge);
      row.appendChild(badgeCell);

      const actionCell = document.createElement('td');
      actionCell.className = 'actions';
      actionCell.appendChild(createActionButton('Edit', 'btn-edit', 'edit', product));
      actionCell.appendChild(createActionButton('Delete', 'btn-danger', 'delete', product));
      row.appendChild(actionCell);

      el.productBody.appendChild(row);
    }

    // Empty states: empty inventory vs. no search matches
    if (products.length === 0) {
      el.emptyState.textContent = 'Your inventory is empty. Add a product to get started.';
      el.emptyState.classList.remove('hidden');
    } else if (visible.length === 0) {
      el.emptyState.textContent = 'No products match your search and filter.';
      el.emptyState.classList.remove('hidden');
    } else {
      el.emptyState.classList.add('hidden');
    }
    el.resultCount.textContent = `Showing ${visible.length} of ${products.length} products`;
  }

  function updateDashboard() {
    const counts = calculateCategoryCounts();
    el.statTotal.textContent = String(products.length);
    el.statValue.textContent = formatCurrency(calculateTotalInventoryValue());
    el.statAverage.textContent = formatCurrency(calculateAveragePrice());
    el.statBudget.textContent = String(counts.Budget);
    el.statPremium.textContent = String(counts.Premium);
  }

  function renderAnalytics() {
    const { most, least } = findPriceExtremes();
    const counts = calculateCategoryCounts();
    const total = products.length;

    el.insights.textContent = '';
    const insightTexts = total === 0
      ? ['No data yet. Add products to see insights.']
      : [
          `Most expensive: ${most.name} (${formatCurrency(most.price)})`,
          `Least expensive: ${least.name} (${formatCurrency(least.price)})`,
          `Price gap: ${formatCurrency(roundToTwo(most.price - least.price))}`,
          `Inventory value = sum of prices; average = value ÷ ${total} products.`
        ];
    for (const text of insightTexts) {
      const li = document.createElement('li');
      li.textContent = text;
      el.insights.appendChild(li);
    }

    el.bars.textContent = '';
    for (const category of ['Budget', 'Premium']) {
      const percent = total === 0 ? 0 : Math.round((counts[category] / total) * 100);   // avoids divide-by-zero
      const wrapper = document.createElement('div');
      wrapper.className = 'bar-row';

      const label = document.createElement('div');
      label.className = 'bar-label';
      const name = document.createElement('span');
      name.textContent = category;
      const value = document.createElement('span');
      value.textContent = `${counts[category]} (${percent}%)`;
      label.append(name, value);

      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = `bar-fill ${category.toLowerCase()}`;
      fill.style.width = `${percent}%`;
      track.appendChild(fill);

      wrapper.append(label, track);
      el.bars.appendChild(wrapper);
    }
  }

  function renderCalculatorOptions() {
    const previous = el.calcProduct.value;
    el.calcProduct.textContent = '';

    if (products.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No products available';
      el.calcProduct.appendChild(option);
    } else {
      for (const product of products) {
        const option = document.createElement('option');
        option.value = String(product.id); // Ensure ID is stored as string
        option.textContent = `${product.name} (${formatCurrency(product.price)})`;
        el.calcProduct.appendChild(option);
      }
      // Check if previous value exists in products list
      const exists = products.some((p) => String(p.id) === previous);
      if (exists) {
        el.calcProduct.value = previous;
      }
    }
    el.calcResult.classList.add('hidden');
    el.calcError.classList.add('hidden');
  }

  // One call refreshes every part of the screen.
  function refreshAll() {
    renderProducts();
    updateDashboard();
    renderAnalytics();
    renderCalculatorOptions();
  }

  /* ------------------------------------------------------------------------
     10. EVENT HANDLERS
     ------------------------------------------------------------------------ */
  const exitEditMode = () => {
    el.editId.value = '';
    el.productForm.reset();
    el.submitBtn.textContent = 'Add Product';
    el.cancelEditBtn.classList.add('hidden');
  };

  // Form submit: adds a new product OR saves an edit.
  const handleFormSubmit = (event) => {
  event.preventDefault();

  console.log("Add Product form submitted!");

  const editing = el.editId.value !== "";

  const result = editing
    ? updateProduct(
        Number(el.editId.value),
        el.productName.value,
        el.productPrice.value
      )
    : addProduct(
        el.productName.value,
        el.productPrice.value
      );

  if (!result.ok) {
    showMessage(result.error, "error");
    return;
  }

  const verb = editing ? "updated" : "added";

  showMessage(
    `"${result.product.name}" ${verb} as a ${result.product.category} product.` +
      (result.saved ? "" : SAVE_WARNING),
    "success"
  );

  exitEditMode();
  refreshAll();
  el.productName.focus();
};

  // "Add Product Using Prompt": prompt() always returns a STRING, or null on Cancel.
  const handlePromptAdd = () => {
    const rawName = window.prompt('Enter the product name:');
    if (rawName === null) {                                    // user pressed Cancel
      showMessage('Prompt cancelled. No product was created.', 'info');
      return;
    }
    const rawPrice = window.prompt('Enter the price in rupees (numbers only):');
    if (rawPrice === null) {
      showMessage('Prompt cancelled. No product was created.', 'info');
      return;
    }
    // Same addProduct() used by the form (trim + Number() conversion happen inside).
    const result = addProduct(rawName, rawPrice);
    if (!result.ok) {
      showMessage(result.error, 'error');
      return;
    }
    showMessage(
      `"${result.product.name}" added as a ${result.product.category} product.` + (result.saved ? '' : SAVE_WARNING),
      'success'
    );
    refreshAll();
  };

  // Event delegation: one listener on the table body handles every Edit/Delete button.
  const handleTableClick = (event) => {
    const button = event.target.closest('button[data-action]');
    if (button === null) return;

    const id = Number(button.dataset.id);
    const product = findProductById(id);
    if (product === null) {
      showMessage('That product could not be found.', 'error');
      return;
    }

    if (button.dataset.action === 'edit') {
      el.editId.value = String(product.id);
      el.productName.value = product.name;
      el.productPrice.value = String(product.price);
      el.submitBtn.textContent = 'Save Changes';
      el.cancelEditBtn.classList.remove('hidden');
      el.productName.focus();
      el.productForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
      const result = deleteProduct(id);
      if (!result.ok) {
        showMessage(result.error, 'error');
        return;
      }
      if (el.editId.value === String(id)) exitEditMode();      // deleted the product being edited
      showMessage(`"${result.product.name}" was deleted.` + (result.saved ? '' : SAVE_WARNING), 'success');
      refreshAll();
    }
  };

  const handleCalculate = (event) => {
    event.preventDefault();
    el.calcResult.classList.add('hidden');
    el.calcError.classList.add('hidden');

    const showCalcError = (text) => {
      el.calcError.textContent = text;
      el.calcError.classList.remove('hidden');
    };

    const selectedId = Number(el.calcProduct.value);
    const product = findProductById(selectedId);
    
    if (!product) {
      showCalcError('Please select an existing product first.');
      return;
    }
    
    const discount = parsePercentage(el.discountRate.value, 'Discount');
    if (!discount.valid) { showCalcError(discount.error); return; }
    const tax = parsePercentage(el.taxRate.value, 'Tax');
    if (!tax.valid) { showCalcError(tax.error); return; }

    const result = calculatePricing(product.price, discount.value, tax.value);
    el.resOriginal.textContent = formatCurrency(result.originalPrice);
    el.resDiscount.textContent = `- ${formatCurrency(result.discountAmount)}`;
    el.resDiscounted.textContent = formatCurrency(result.discountedPrice);
    el.resTax.textContent = `+ ${formatCurrency(result.taxAmount)}`;
    el.resFinal.textContent = formatCurrency(result.finalPrice);
    el.calcResult.classList.remove('hidden');
  };

    

  const handleReset = () => {
    if (!window.confirm('Reset inventory to the sample products? Your current products will be lost.')) return;
    products = getSampleCopy();
    filters.query = '';
    filters.category = 'All';
    el.searchInput.value = '';
    el.categoryFilter.value = 'All';
    exitEditMode();
    const saved = saveProducts();
    refreshAll();
    showMessage('Inventory reset to sample data.' + (saved ? '' : SAVE_WARNING), 'success');
  };

  /* ------------------------------------------------------------------------
     11. START-UP
     ------------------------------------------------------------------------ */
  function init() {
    el.thresholdHint.textContent = BUDGET_LIMIT.toLocaleString('en-IN');
    el.thresholdHint2.textContent = BUDGET_LIMIT.toLocaleString('en-IN');

    products = loadProducts();

    el.productForm.addEventListener('submit', handleFormSubmit);
    el.cancelEditBtn.addEventListener('click', exitEditMode);
    el.promptBtn.addEventListener('click', handlePromptAdd);
    el.resetBtn.addEventListener('click', handleReset);
    el.productBody.addEventListener('click', handleTableClick);
    el.calcForm.addEventListener('submit', handleCalculate);

    // Live search: runs on every keystroke
    el.searchInput.addEventListener('input', () => {
      filters.query = el.searchInput.value;
      renderProducts();
    });
    el.categoryFilter.addEventListener('change', () => {
      filters.category = el.categoryFilter.value;
      renderProducts();
    });
    el.reportBtn.addEventListener('click', () => {
      el.reportOutput.textContent = generateReport(el.reportType.value);
    });

    refreshAll();
  }

  init();
})();