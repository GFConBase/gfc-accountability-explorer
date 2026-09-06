export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (value === null || value === undefined) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'attrs') for (const [name, attrValue] of Object.entries(value)) node.setAttribute(name, String(attrValue));
    else node[key] = value;
  }
  const normalized = Array.isArray(children) ? children : [children];
  for (const child of normalized) if (child) node.append(child);
  return node;
}

export function clear(node) {
  node.replaceChildren();
}

export function externalLink(href, text, className = '') {
  const link = el('a', { className, text, attrs: { href, target: '_blank', rel: 'noopener noreferrer' } });
  return link;
}
