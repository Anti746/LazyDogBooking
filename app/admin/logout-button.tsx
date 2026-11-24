"use client";

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "/admin/login";
      }}
      className="rounded-lg border border-line px-3 py-1.5 hover:bg-sand"
    >
      Log out
    </button>
  );
}
