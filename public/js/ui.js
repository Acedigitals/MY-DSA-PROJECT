export function el(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === 'className') {
      element.className = value;
    } else if (name === 'textContent') {
      element.textContent = value;
    } else if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null) {
      element.setAttribute(name, String(value));
    }
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child instanceof Node) element.append(child);
    else if (child !== undefined && child !== null) element.append(document.createTextNode(String(child)));
  }
  return element;
}

export function formatPrice(priceCents) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(priceCents / 100);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(date));
}
