export default function Loading() {
  return (
    <div className="page-shell py-24" aria-busy="true">
      <div className="skeleton h-5 w-32 mx-auto" />
      <div className="skeleton h-16 max-w-xl mx-auto mt-6" />
      <div className="skeleton h-8 max-w-md mx-auto mt-6" />
      <div className="skeleton h-80 mt-12" />
    </div>
  );
}
