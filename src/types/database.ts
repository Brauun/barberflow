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
          responsavel_cpf: string | null
          telefone: string | null
          email: string | null
          endereco: string | null
          cep: string | null
          rua: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          estado: string | null
          complemento: string | null
          latitude: number | null
          longitude: number | null
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
          responsavel_cpf?: string | null
          telefone?: string | null
          email?: string | null
          endereco?: string | null
          cep?: string | null
          rua?: string | null
          numero?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          complemento?: string | null
          latitude?: number | null
          longitude?: number | null
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
          avatar_url: string | null
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
          avatar_url?: string | null
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
          duration_minutes: number | null
          preco: number
          ativo: boolean
          categoria: string | null
          percentual_comissao: number | null
          status: 'ativo' | 'inativo'
          allow_barber_create: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          nome: string
          descricao?: string | null
          duracao_minutos: number
          duration_minutes?: number | null
          preco: number
          ativo?: boolean
          categoria?: string | null
          percentual_comissao?: number | null
          status?: 'ativo' | 'inativo'
          allow_barber_create?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          nome?: string
          descricao?: string | null
          duracao_minutos?: number
          duration_minutes?: number | null
          preco?: number
          ativo?: boolean
          categoria?: string | null
          percentual_comissao?: number | null
          status?: 'ativo' | 'inativo'
          allow_barber_create?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      barber_services: {
        Row: {
          id: string
          empresa_id: string
          barbeiro_id: string
          service_id: string
          custom_duration: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          barbeiro_id: string
          service_id: string
          custom_duration?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          barbeiro_id?: string
          service_id?: string
          custom_duration?: number | null
          active?: boolean
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
          valor_original: number | null
          valor_desconto: number
          valor_final: number | null
          motivo_desconto: string | null
          comissao_base: 'cheio' | 'liquido'
          desconto: number
          forma_pagamento: string | null
          status:
            | 'agendado'
            | 'confirmado'
            | 'em_atendimento'
            | 'concluido'
            | 'cancelado'
            | 'remarcado'
            | 'nao_compareceu'
            | 'faltou'
          cancelled_at: string | null
          cancelled_by: string | null
          cancellation_reason: string | null
          rescheduled_from_starts_at: string | null
          rescheduled_from_ends_at: string | null
          rescheduled_at: string | null
          rescheduled_by: string | null
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
          valor_original?: number | null
          valor_desconto?: number
          valor_final?: number | null
          motivo_desconto?: string | null
          comissao_base?: 'cheio' | 'liquido'
          desconto?: number
          forma_pagamento?: string | null
          status?:
            | 'agendado'
            | 'confirmado'
            | 'em_atendimento'
            | 'concluido'
            | 'cancelado'
            | 'remarcado'
            | 'nao_compareceu'
            | 'faltou'
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancellation_reason?: string | null
          rescheduled_from_starts_at?: string | null
          rescheduled_from_ends_at?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
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
          appointment_id: string | null
          tipo: 'entrada' | 'saida'
          categoria: string
          descricao: string | null
          valor: number
          forma_pagamento: string | null
          data_movimentacao: string
          status: 'pendente' | 'confirmada' | 'cancelada'
          cancelled_at: string | null
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
      profiles: {
        Row: {
          id: string
          auth_user_id: string
          role: 'barbearia' | 'cliente'
          nome: string
          email: string | null
          telefone: string | null
          avatar_url: string | null
          primary_barbershop_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          role: 'barbearia' | 'cliente'
          nome: string
          email?: string | null
          telefone?: string | null
          avatar_url?: string | null
          primary_barbershop_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      barbershops: {
        Row: {
          id: string
          empresa_id: string | null
          nome: string
          telefone: string | null
          email: string | null
          endereco: string | null
          cep: string | null
          rua: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          estado: string | null
          complemento: string | null
          logo_url: string | null
          latitude: number | null
          longitude: number | null
          rating: number
          total_appointments: number
          average_wait_minutes: number
          status: 'ativa' | 'inativa'
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['barbershops']['Row']> & {
          nome: string
        }
        Update: Partial<Database['public']['Tables']['barbershops']['Insert']>
        Relationships: []
      }
      client_favorite_barbershops: {
        Row: {
          id: string
          client_id: string
          empresa_id: string | null
          barbershop_id: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          empresa_id?: string | null
          barbershop_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['client_favorite_barbershops']['Insert']>
        Relationships: []
      }
      plans: {
        Row: {
          id: string
          name: string
          slug:
            | 'starter'
            | 'professional'
            | 'premium'
            | 'STARTER'
            | 'PROFESSIONAL'
            | 'PREMIUM'
          description: string | null
          monthly_price: number
          yearly_price: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['plans']['Row']> & {
          name: string
          slug:
            | 'starter'
            | 'professional'
            | 'premium'
            | 'STARTER'
            | 'PROFESSIONAL'
            | 'PREMIUM'
        }
        Update: Partial<Database['public']['Tables']['plans']['Insert']>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          empresa_id: string
          plan_id: string
          status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'
          started_at: string
          expires_at: string | null
          trial_ends_at: string | null
          canceled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']> & {
          empresa_id: string
          plan_id: string
        }
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
        Relationships: []
      }
      subscription_features: {
        Row: {
          id: string
          plan_id: string
          feature_key: string
          feature_value: Json
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['subscription_features']['Row']> & {
          plan_id: string
          feature_key: string
          feature_value: Json
        }
        Update: Partial<Database['public']['Tables']['subscription_features']['Insert']>
        Relationships: []
      }
      subscription_usage: {
        Row: {
          id: string
          empresa_id: string
          feature_key: string
          current_value: number
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['subscription_usage']['Row']> & {
          empresa_id: string
          feature_key: string
        }
        Update: Partial<Database['public']['Tables']['subscription_usage']['Insert']>
        Relationships: []
      }
      client_barbershop: {
        Row: {
          id: string
          client_profile_id: string
          barbershop_id: string
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_profile_id: string
          barbershop_id: string
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['client_barbershop']['Insert']>
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          empresa_id: string | null
          barbershop_id: string | null
          client_profile_id: string | null
          atendimento_id: string | null
          barbeiro_id: string | null
          starts_at: string
          ends_at: string
          status:
            | 'agendado'
            | 'confirmado'
            | 'em_atendimento'
            | 'concluido'
            | 'cancelado'
            | 'remarcado'
            | 'nao_compareceu'
            | 'faltou'
          valor_original: number
          valor_desconto: number
          valor_final: number
          motivo_desconto: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancellation_reason: string | null
          rescheduled_from_starts_at: string | null
          rescheduled_from_ends_at: string | null
          rescheduled_at: string | null
          rescheduled_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['appointments']['Row']> & {
          starts_at: string
          ends_at: string
        }
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>
        Relationships: []
      }
      appointment_status_logs: {
        Row: {
          id: string
          appointment_id: string
          source: 'appointments' | 'atendimentos'
          empresa_id: string | null
          old_status: string | null
          new_status: string
          changed_by: string | null
          changed_by_role: string | null
          reason: string | null
          metadata: Json
          created_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['appointment_status_logs']['Row']
        > & {
          appointment_id: string
          new_status: string
        }
        Update: Partial<
          Database['public']['Tables']['appointment_status_logs']['Insert']
        >
        Relationships: []
      }
      appointment_items: {
        Row: {
          id: string
          appointment_id: string
          servico_id: string | null
          nome: string
          duration_minutes: number
          valor_original: number
          valor_desconto: number
          valor_final: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['appointment_items']['Row']> & {
          appointment_id: string
          nome: string
        }
        Update: Partial<Database['public']['Tables']['appointment_items']['Insert']>
        Relationships: []
      }
      appointment_waitlist: {
        Row: {
          id: string
          empresa_id: string
          client_id: string
          service_id: string
          barber_id: string | null
          desired_date: string
          preferred_period: 'manha' | 'tarde' | 'noite' | 'qualquer' | null
          status: 'aguardando' | 'notificado' | 'agendado' | 'cancelado' | 'expirado'
          notified_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['appointment_waitlist']['Row']> & {
          empresa_id: string
          client_id: string
          service_id: string
          desired_date: string
        }
        Update: Partial<Database['public']['Tables']['appointment_waitlist']['Insert']>
        Relationships: []
      }
      notification_logs: {
        Row: {
          id: string
          empresa_id: string | null
          client_id: string | null
          channel: string
          type: string
          message: string
          status: 'pendente' | 'enviado' | 'erro' | 'cancelado'
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['notification_logs']['Row']> & {
          type: string
          message: string
        }
        Update: Partial<Database['public']['Tables']['notification_logs']['Insert']>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          empresa_id: string | null
          user_id: string | null
          user_role: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']> & {
          action: string
          entity_type: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
        Relationships: []
      }
      error_logs: {
        Row: {
          id: string
          empresa_id: string | null
          user_id: string | null
          area: string
          message: string
          stack: string | null
          metadata: Json
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['error_logs']['Row']> & {
          area: string
          message: string
        }
        Update: Partial<Database['public']['Tables']['error_logs']['Insert']>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          empresa_id: string
          recipient_user_id: string | null
          recipient_employee_id: string | null
          type: string
          title: string
          message: string
          metadata: Json
          read_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & {
          empresa_id: string
          type: string
          title: string
          message: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
        Relationships: []
      }
      discount_logs: {
        Row: {
          id: string
          empresa_id: string | null
          appointment_id: string | null
          atendimento_id: string | null
          tipo: 'valor' | 'percentual'
          motivo: 'Promoção' | 'Cliente fiel' | 'Cupom' | 'Cortesia' | 'Outro'
          valor_original: number
          valor_desconto: number
          valor_final: number
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['discount_logs']['Row']> & {
          tipo: 'valor' | 'percentual'
          motivo: 'Promoção' | 'Cliente fiel' | 'Cupom' | 'Cortesia' | 'Outro'
          valor_original: number
          valor_desconto: number
          valor_final: number
        }
        Update: Partial<Database['public']['Tables']['discount_logs']['Insert']>
        Relationships: []
      }
      barber_unavailability: {
        Row: {
          id: string
          empresa_id: string
          barber_id: string
          date: string
          all_day: boolean
          start_time: string | null
          end_time: string | null
          reason: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['barber_unavailability']['Row']
        > & {
          empresa_id: string
          barber_id: string
          date: string
          reason: string
        }
        Update: Partial<
          Database['public']['Tables']['barber_unavailability']['Insert']
        >
        Relationships: []
      }
      barbershop_business_hours: {
        Row: {
          id: string
          empresa_id: string
          day_of_week: number
          is_open: boolean
          open_time: string | null
          close_time: string | null
          break_start: string | null
          break_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['barbershop_business_hours']['Row']
        > & {
          empresa_id: string
          day_of_week: number
        }
        Update: Partial<
          Database['public']['Tables']['barbershop_business_hours']['Insert']
        >
        Relationships: []
      }
      barbershop_special_hours: {
        Row: {
          id: string
          empresa_id: string
          date: string
          is_closed: boolean
          open_time: string | null
          close_time: string | null
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['barbershop_special_hours']['Row']
        > & {
          empresa_id: string
          date: string
        }
        Update: Partial<
          Database['public']['Tables']['barbershop_special_hours']['Insert']
        >
        Relationships: []
      }
      benefit_programs: {
        Row: {
          id: string
          empresa_id: string
          nome: string
          descricao: string | null
          tipo: string
          valor: number
          validade_dias: number | null
          renovacao_periodo: string | null
          acumulavel: boolean
          regra_acumulo: string | null
          regra_resgate: string | null
          publico_alvo: string
          status: 'ativo' | 'inativo'
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['benefit_programs']['Row']> & {
          empresa_id: string
          nome: string
        }
        Update: Partial<Database['public']['Tables']['benefit_programs']['Insert']>
        Relationships: []
      }
      benefit_rules: {
        Row: {
          id: string
          empresa_id: string
          program_id: string
          tipo_regra: string
          parametros: Json
          servico_ids: string[]
          categorias_servico: string[]
          cliente_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['benefit_rules']['Row']> & {
          empresa_id: string
          program_id: string
          tipo_regra: string
        }
        Update: Partial<Database['public']['Tables']['benefit_rules']['Insert']>
        Relationships: []
      }
      benefit_rewards: {
        Row: {
          id: string
          empresa_id: string
          program_id: string
          tipo_recompensa: string
          descricao: string | null
          valor: number
          servico_id: string | null
          parametros: Json
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['benefit_rewards']['Row']> & {
          empresa_id: string
          program_id: string
          tipo_recompensa: string
        }
        Update: Partial<Database['public']['Tables']['benefit_rewards']['Insert']>
        Relationships: []
      }
      client_benefits: {
        Row: {
          id: string
          empresa_id: string
          program_id: string
          cliente_id: string | null
          status: 'ativo' | 'pausado' | 'expirado' | 'cancelado' | 'concluido'
          saldo_usos: number
          saldo_credito: number
          pontos: number
          starts_at: string
          expires_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['client_benefits']['Row']> & {
          empresa_id: string
          program_id: string
        }
        Update: Partial<Database['public']['Tables']['client_benefits']['Insert']>
        Relationships: []
      }
      benefit_usage_logs: {
        Row: {
          id: string
          empresa_id: string
          program_id: string
          client_benefit_id: string | null
          cliente_id: string | null
          atendimento_id: string | null
          tipo: string
          valor_desconto: number
          descricao: string | null
          metadata: Json
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['benefit_usage_logs']['Row']> & {
          empresa_id: string
          program_id: string
        }
        Update: Partial<Database['public']['Tables']['benefit_usage_logs']['Insert']>
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          auth_user_id: string | null
          nome: string
          email: string
          telefone: string | null
          avatar_url: string | null
          status: 'ativo' | 'inativo'
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['employees']['Row']> & {
          nome: string
          email: string
        }
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
        Relationships: []
      }
      barbershop_employee_links: {
        Row: {
          id: string
          employee_id: string
          empresa_id: string
          barbershop_id: string | null
          role: UserRole
          commission_percentage: number
          status: 'ativo' | 'inativo'
          joined_at: string | null
          left_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['barbershop_employee_links']['Row']
        > & {
          employee_id: string
          empresa_id: string
          role: UserRole
        }
        Update: Partial<
          Database['public']['Tables']['barbershop_employee_links']['Insert']
        >
        Relationships: []
      }
      employee_invitations: {
        Row: {
          id: string
          empresa_id: string
          barbershop_id: string | null
          employee_id: string | null
          nome: string
          email: string
          telefone: string | null
          role: UserRole
          commission_percentage: number
          token: string
          status: 'pendente' | 'aceito' | 'expirado' | 'cancelado'
          expires_at: string
          accepted_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Partial<
          Database['public']['Tables']['employee_invitations']['Row']
        > & {
          empresa_id: string
          nome: string
          email: string
          role: UserRole
          commission_percentage: number
          token: string
          expires_at: string
        }
        Update: Partial<
          Database['public']['Tables']['employee_invitations']['Insert']
        >
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      criar_empresa_com_usuario: {
        Args: {
          nome_empresa: string
          nome_usuario: string
          responsavel_cpf?: string | null
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
      create_employee_invitation: {
        Args: {
          p_empresa_id: string
          p_nome: string
          p_email: string
          p_telefone: string
          p_role: UserRole
          p_commission_percentage: number
          p_created_by: string | null
        }
        Returns: Database['public']['Tables']['employee_invitations']['Row']
      }
      accept_employee_invitation: {
        Args: {
          p_token: string
          p_nome: string
          p_telefone: string
        }
        Returns: Database['public']['Tables']['employee_invitations']['Row']
      }
      get_booking_busy_slots: {
        Args: {
          p_barbershop_id: string
          p_barbeiro_id: string
          p_date: string
          p_exclude_appointment_id?: string | null
        }
        Returns: Array<{
          starts_at: string
          ends_at: string
        }>
      }
      create_internal_notification: {
        Args: {
          p_empresa_id: string
          p_type: string
          p_title: string
          p_message: string
          p_metadata?: Json
          p_barber_name?: string | null
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type UserRole = 'administrador' | 'gerente' | 'barbeiro' | 'recepcao'

export type Empresa = Database['public']['Tables']['empresas']['Row']

export type Usuario = Database['public']['Tables']['usuarios']['Row']
