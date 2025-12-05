const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

// Configurar porta para Render
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// ========== CONFIGURAÇÃO ==========
const SENHA_ADMIN = process.env.ADMIN_PASSWORD || "admin123"; // Pode mudar no Render

const DB_PATH = path.join(__dirname, "internal", "chamados.json");

// Sistema de IDs sequenciais
let ultimoId = 0;

// Criar arquivo se não existir
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]), 'utf8');
}

// ========== FUNÇÕES AUXILIARES ==========
function loadChamados() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Erro ao carregar chamados:", err);
        return [];
    }
}

function saveChamados(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Erro ao salvar chamados:", err);
    }
}

function formatarDataPublica(dataString) {
    if (!dataString || dataString === "-") return "-";
    try {
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR');
    } catch (err) {
        return dataString;
    }
}

function carregarUltimoId() {
    try {
        const chamados = loadChamados();
        if (chamados.length > 0) {
            ultimoId = Math.max(...chamados.map(c => c.id));
        } else {
            ultimoId = 0;
        }
        console.log(`📊 Último ID carregado: ${ultimoId}`);
    } catch (err) {
        console.error("Erro ao carregar último ID:", err);
        ultimoId = 0;
    }
}

// Carregar último ID ao iniciar
carregarUltimoId();

function verificarAutenticacao(req, res, next) {
    const token = req.headers.authorization;
    const senhaEsperada = process.env.ADMIN_PASSWORD || SENHA_ADMIN;
    
    if (token === `Bearer ${senhaEsperada}`) {
        next();
    } else {
        res.status(401).json({ erro: "Não autorizado" });
    }
}

// ========== ROTAS PÚBLICAS ==========
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/sucesso", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "sucesso.html"));
});

app.get("/acompanhar", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "acompanhar.html"));
});

// API Pública - Abrir chamado
app.post("/api/abrir", (req, res) => {
    try {
        const chamados = loadChamados();
        ultimoId++; // Incrementa o ID
        
        const novoChamado = {
            id: ultimoId,
            nome: req.body.nome,
            matricula: req.body.matricula,
            ramal: req.body.ramal,
            setor: req.body.setor,
            descricao: req.body.descricao,
            status: "Aberto",
            responsavel: "",
            fechadoPor: "",
            dataAbertura: new Date().toISOString(),
            atualizacoes: [
                {
                    data: new Date().toISOString(),
                    status: "Aberto",
                    mensagem: "Chamado aberto pelo sistema"
                }
            ]
        };
        
        chamados.push(novoChamado);
        saveChamados(chamados);
        
        res.json({ 
            sucesso: true,
            id: novoChamado.id,
            data: novoChamado.dataAbertura
        });
    } catch (err) {
        console.error("Erro ao abrir chamado:", err);
        res.status(500).json({ erro: "Erro ao abrir chamado" });
    }
});

// API Pública - Buscar chamado por ID
app.get("/api/buscar/:id", (req, res) => {
    try {
        const chamados = loadChamados();
        const id = parseInt(req.params.id);
        
        if (isNaN(id) || id < 1) {
            return res.status(400).json({ erro: "ID inválido" });
        }
        
        const chamado = chamados.find(c => c.id === id);
        
        if (!chamado) {
            return res.status(404).json({ erro: "Chamado não encontrado" });
        }
        
        // Não mostrar campos sensíveis para o público
        const chamadoPublico = {
            id: chamado.id,
            nome: chamado.nome,
            setor: chamado.setor,
            descricao: chamado.descricao,
            status: chamado.status,
            responsavel: chamado.responsavel || "Não atribuído",
            dataAbertura: formatarDataPublica(chamado.dataAbertura),
            dataFechamento: chamado.dataFechamento ? formatarDataPublica(chamado.dataFechamento) : null,
            atualizacoes: chamado.atualizacoes || []
        };
        
        res.json({ sucesso: true, chamado: chamadoPublico });
    } catch (err) {
        console.error("Erro ao buscar chamado:", err);
        res.status(500).json({ erro: "Erro ao buscar chamado" });
    }
});

// ========== ROTAS DO ADMIN (PROTEGIDAS) ==========
app.post("/api/login", (req, res) => {
    const { senha } = req.body;
    const senhaEsperada = process.env.ADMIN_PASSWORD || SENHA_ADMIN;
    
    if (senha === senhaEsperada) {
        res.json({ sucesso: true });
    } else {
        res.json({ sucesso: false, erro: "Senha incorreta" });
    }
});

app.get("/api/chamados", verificarAutenticacao, (req, res) => {
    try {
        res.json(loadChamados());
    } catch (err) {
        console.error("Erro ao carregar chamados:", err);
        res.status(500).json({ erro: "Erro ao carregar" });
    }
});

app.post("/api/atualizar", verificarAutenticacao, (req, res) => {
    try {
        const chamados = loadChamados();
        const c = chamados.find(x => x.id === req.body.id);

        if (!c) return res.json({ erro: "Chamado não encontrado" });

        const mudancas = [];
        
        if (req.body.status && req.body.status !== c.status) {
            c.status = req.body.status;
            mudancas.push(`Status alterado para: ${req.body.status}`);
        }
        
        if (req.body.responsavel && req.body.responsavel !== c.responsavel) {
            c.responsavel = req.body.responsavel;
            mudancas.push(`Responsável atribuído: ${req.body.responsavel}`);
        }
        
        if (req.body.fechadoPor) {
            c.fechadoPor = req.body.fechadoPor;
            c.dataFechamento = new Date().toISOString();
            mudancas.push(`Chamado fechado por: ${req.body.fechadoPor}`);
        }

        // Registrar histórico se houve mudanças
        if (mudancas.length > 0) {
            if (!c.atualizacoes) c.atualizacoes = [];
            c.atualizacoes.push({
                data: new Date().toISOString(),
                status: c.status,
                mensagem: mudancas.join(' | ')
            });
        }

        saveChamados(chamados);
        res.json({ sucesso: true });
    } catch (err) {
        console.error("Erro ao atualizar chamado:", err);
        res.status(500).json({ erro: "Erro ao atualizar" });
    }
});

app.post("/api/excluir", verificarAutenticacao, (req, res) => {
    try {
        const chamados = loadChamados();
        const c = chamados.find(x => x.id === req.body.id);

        if (!c) return res.json({ erro: "Chamado não encontrado" });

        c.status = "Excluído";
        c.excluidoPor = req.body.excluidoPor || "Sistema";
        c.dataExclusao = new Date().toISOString();
        
        // Registrar exclusão no histórico
        if (!c.atualizacoes) c.atualizacoes = [];
        c.atualizacoes.push({
            data: new Date().toISOString(),
            status: "Excluído",
            mensagem: `Chamado excluído por: ${c.excluidoPor}`
        });

        saveChamados(chamados);
        res.json({ sucesso: true });
    } catch (err) {
        console.error("Erro ao excluir chamado:", err);
        res.status(500).json({ erro: "Erro ao excluir" });
    }
});

app.post("/api/restaurar", verificarAutenticacao, (req, res) => {
    try {
        const chamados = loadChamados();
        const c = chamados.find(x => x.id === req.body.id);

        if (!c) return res.json({ erro: "Chamado não encontrado" });

        c.status = "Aberto";
        if (c.excluidoPor) delete c.excluidoPor;
        if (c.dataExclusao) delete c.dataExclusao;
        
        // Registrar restauração no histórico
        if (!c.atualizacoes) c.atualizacoes = [];
        c.atualizacoes.push({
            data: new Date().toISOString(),
            status: "Aberto",
            mensagem: "Chamado restaurado do status Excluído"
        });

        saveChamados(chamados);
        res.json({ sucesso: true });
    } catch (err) {
        console.error("Erro ao restaurar chamado:", err);
        res.status(500).json({ erro: "Erro ao restaurar" });
    }
});

// Rota de saúde para o Render
app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log("=".repeat(50));
    console.log(`✅ Servidor rodando na porta: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
    console.log("🎯 Sistema de Chamados UNIEURO");
    console.log("=".repeat(50));
});