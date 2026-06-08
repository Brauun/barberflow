import { Badge, Card, CardContent, CardHeader, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui'

type AppSectionPageProps = {
  description: string
  title: string
}

export function AppSectionPage({ description, title }: AppSectionPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
          BW Barber
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Status</p>
            <p className="mt-2 text-2xl font-semibold">Em estruturação</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Permissões</p>
            <p className="mt-2 text-2xl font-semibold">Multi-tenant</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Tema</p>
            <p className="mt-2 text-2xl font-semibold">Proprietario</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Visão geral</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Área preparada para receber os dados do módulo.
              </p>
            </div>
            <Badge variant="warning">Base pronta</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Item</TableHeaderCell>
                <TableHeaderCell>Categoria</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                  Estrutura visual
                </TableCell>
                <TableCell>{title}</TableCell>
                <TableCell>
                  <Badge variant="success">Disponível</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
