"use client";
export default function WorkspaceError({ retry }: { retry: () => void }) {
  return (
    <section className="panel" role="alert">
      <h2>اطلاعات این بخش در دسترس نیست</h2>
      <p>داده‌ای جایگزین اطلاعات واقعی نشده است. دوباره تلاش کنید.</p>
      <button className="button" type="button" onClick={() => retry()}>
        تلاش دوباره
      </button>
    </section>
  );
}
