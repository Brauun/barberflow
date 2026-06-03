export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string
          nome: string
          documento: string | null
          telefone: string | null
          email: string | null
          endereco: string | null
          logo_url: string | null
          percentual_comissao_padrao: number
          status: 'ativa' | 'inativa' | 'suspensa'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          documento?: string | null
          telefone?: string | null
          email?: string | null
          endereco?: string | null
          logo_url?: string | null
          percentual_comissao_padrao?: number
          status?: 'ativa' | 'inativa' | 'suspensa'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['empresas']['Insert']>
        Relationships: []
      }
      usuarios: {
        Row: {
          id: string
          empresa_id: string
          auth_user_id: string
          nome: string
          email: string
          telefone: string | null
          papel: UserRole
          status: 'ativo' | 'inativo' | 'bloqueado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          auth_user_id: string
          nome: string
          email: string
          telefone?: string | null
          papel?: UserRole
          status?: 'ativo' | 'inativo' | 'bloqueado'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          empresa_id: string
          nome: string
          telefone: string | null
          email: string | null
          data_nascimento: string | null
          observacoes: string | null
          status: 'ativo' | 'inativo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          nome: string
          telefone?: string | null
          email?: string | null
          data_nascimento?: string | null
          observacoes?: string | null
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          nome?: string
          telefone?: string | null
          email?: string | null
          data_nascimento?: string | null
          observacoes?: string | null
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      barbeiros: {
        Row: {
          id: string
          empresa_id: string
          usuario_id: string | null
          nome: string
          telefone: string | null
          email: string | null
          percentual_comissao: number
          status: 'ativo' | 'inativo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          usuario_id?: string | null
          nome: string
          telefone?: string | null
          email?: string | null
          percentual_comissao?: number
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          usuario_id?: string | null
          nome?: string
          telefone?: string | null
          email?: string | null
          percentual_comissao?: number
          status?: 'ativo' | 'inativo'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          id: string
          empresa_id: string
          nome: string
          descricao: string | null
          duracao_minutos: number
          preco: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          nome: string
          descricao?: string | null
          duracao_minutos: number
          preco: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          nome?: string
          descricao?: string | null
          duracao_minutos?: number
          preco?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      atendimentos: {
        Row: {
          id: string
          empresa_id: string
          cliente_id: string
          barbeiro_id: string
          servico_id: string
          data_hora_inicio: string
          data_hora_fim: string | null
          valor: number
          desconto: number
          forma_pagamento: string | null
          status: 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou'
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          cliente_id: string
          barbeiro_id: string
          servico_id: string
          data_hora_inicio: string
          data_hora_fim?: string | null
          valor: number
          desconto?: number
          forma_pagamento?: string | null
          status?: 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou'
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['atendimentos']['Insert']>
        Relationships: []
      }
      movimentacoes_financeiras: {
        Row: {
          id: string
          empresa_id: string
          atendimento_id: string | null
          tipo: 'entrada' | 'saida'
          categoria: string
          descricao: string | null
          valor: number
          forma_pagamento: string | null
          data_movimentacao: string
          status: 'pendente' | 'confirmada' | 'cancelada'
          created_at: string
          updated_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['movimentacoes_financeiras']['Row']
        > & {
          empresa_id: string
          tipo: 'entrada' | 'saida'
          categoria: string
          valor: number
        }
        Update: Partial<
          Database['public']['Tables']['movimentacoes_financeiras']['Insert']
        >
        Relationships: []
      }
      contas_pagar: {
        Row: {
          id: string
          empresa_id: string
          descricao: string
          fornecedor: string | null
          categoria: string | null
          valor: number
          data_vencimento: string
          data_pagamento: string | null
          status: 'pendente' | 'paga' | 'vencida' | 'cancelada'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          descricao: string
          fornecedor?: string | null
          categoria?: string | null
          valor: number
          data_vencimento: string
          data_pagamento?: string | null
          status?: 'pendente' | 'paga' | 'vencida' | 'cancelada'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['contas_pagar']['Insert']>
        Relationships: []
      }
      comissoes: {
        Row: {
          id: string
          empresa_id: string
          atendimento_id: string
          barbeiro_id: string
          percentual: number
          valor_base: number
          valor_comissao: number
          status: 'pendente' | 'paga' | 'cancelada'
          data_pagamento: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['comissoes']['Row']> & {
          empresa_id: string
          atendimento_id: string
          barbeiro_id: string
          percentual: number
          valor_base: number
          valor_comissao: number
        }
        Update: Partial<Database['public']['Tables']['comissoes']['Insert']>
        Relationships: []
      }
      produtos: {
        Row: {
          id: string
          empresa_id: string
          nome: string
          categoria: string | null
          descricao: string | null
          sku: string | null
          preco_custo: number
          preco_venda: number
          estoque_atual: number
          estoque_minimo: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          nome: string
          categoria?: string | null
          descricao?: string | null
          sku?: string | null
          preco_custo?: number
          preco_venda?: number
          estoque_atual?: number
          estoque_minimo?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          nome?: string
          categoria?: string | null
          descricao?: string | null
          sku?: string | null
          preco_custo?: number
          preco_venda?: number
          estoque_atual?: number
          estoque_minimo?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendas_produtos: {
        Row: {
          id: string
          empresa_id: string
          produto_id: string
          quantidade: number
          valor_unitario: number
          valor_total: number
          forma_pagamento: string | null
          data_venda: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          produto_id: string
          quantidade: number
          valor_unitario: number
          valor_total: number
          forma_pagamento?: string | null
          data_venda?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['vendas_produtos']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      criar_empresa_com_usuario: {
        Args: {
          nome_empresa: string
          nome_usuario: string
          telefone_usuario?: string | null
          papel_usuario?: UserRole
        }
        Returns: Database['public']['Tables']['usuarios']['Row']
      }
      registrar_atendimento: {
        Args: {
          p_empresa_id: string
          p_cliente_id: string
          p_barbeiro_id: string
          p_servico_id: string
          p_data_hora_inicio: string
          p_valor: number
          p_forma_pagamento: string
        }
        Returns: Database['public']['Tables']['atendimentos']['Row']
      }
      registrar_entrada_estoque: {
        Args: {
          p_empresa_id: string
          p_produto_id: string
          p_quantidade: number
        }
        Returns: Database['public']['Tables']['produtos']['Row']
      }
      registrar_venda_produto: {
        Args: {
          p_empresa_id: string
          p_produto_id: string
          p_quantidade: number
          p_forma_pagamento: string
        }
        Returns: Database['public']['Tables']['produtos']['Row']
      }
      marcar_conta_paga: {
        Args: {
          p_empresa_id: string
          p_conta_id: string
        }
        Returns: Database['public']['Tables']['contas_pagar']['Row']
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type UserRole = 'administrador' | 'gerente' | 'barbeiro'

export type Empresa = Database['public']['Tables']['empresas']['Row']

export type Usuario = Database['public']['Tables']['usuarios']['Row']
