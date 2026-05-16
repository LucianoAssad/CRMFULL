export default function Placeholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6 rounded-md border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        Este módulo está em preparação.
      </div>
    </div>
  );
}
