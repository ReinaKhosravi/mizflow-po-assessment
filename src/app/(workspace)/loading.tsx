export default function WorkspaceLoading() {
  return (
    <section
      className="panel"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <h2>در حال دریافت اطلاعات…</h2>
      <p>لطفاً چند لحظه صبر کنید.</p>
    </section>
  );
}
