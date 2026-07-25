import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';

interface PagePlaceholderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** Consistent shell for pages whose real content ships with a later feature. */
export function PagePlaceholder({ title, description, children }: PagePlaceholderProps) {
  return (
    <Container className="py-16">
      <Badge variant="volt" className="mb-4">
        Coming soon
      </Badge>
      <h1 className="font-display text-3xl uppercase tracking-wide text-white sm:text-4xl">
        {title}
      </h1>
      {description && <p className="mt-3 max-w-2xl text-zinc-400">{description}</p>}
      {children}
    </Container>
  );
}
