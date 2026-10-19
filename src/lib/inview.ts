const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | undefined;

function shared(): IntersectionObserver {
  return (observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        callbacks.get(entry.target)?.();
        callbacks.delete(entry.target);
        observer!.unobserve(entry.target);
      }
    },
    { rootMargin: '1200px 0px' },
  ));
}

/** Calls `onSeen` once, when the node comes within a screen or so of the viewport. */
export function inview(node: Element, onSeen: () => void) {
  callbacks.set(node, onSeen);
  shared().observe(node);
  return {
    destroy() {
      callbacks.delete(node);
      observer?.unobserve(node);
    },
  };
}
