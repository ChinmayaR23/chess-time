export function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "ssr-placeholder";
  let id = localStorage.getItem("chess-guest-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("chess-guest-id", id);
  }
  return id;
}

export function getOrCreateGuestName(): string {
  if (typeof window === "undefined") return "Guest";
  let name = localStorage.getItem("chess-guest-name");
  if (!name) {
    name = `Guest${Math.floor(Math.random() * 9000) + 1000}`;
    localStorage.setItem("chess-guest-name", name);
  }
  return name;
}
