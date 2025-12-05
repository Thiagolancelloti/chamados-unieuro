const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());


app.use((req, res, next) => {
    if (req.body) {
        
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = corrigirEncoding(req.body[key]);
            }
        });
    }
    next();
});

app.use(express.static("public"));

// ========== CONFIGURAÇÃO ==========
const SENHA_ADMIN = "admin123";

const DB_PATH = path.join(__dirname, "internal", "chamados.json");


function corrigirEncoding(texto) {
    if (!texto) return texto;
    
    return String(texto)
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã£/g, 'ã')
        .replace(/Ãµ/g, 'õ')
        .replace(/Ã§/g, 'ç')
        .replace(/Ã€/g, 'À')
        .replace(/Ã‰/g, 'É')
        .replace(/Ã/g, 'Í')
        .replace(/Ã“/g, 'Ó')
        .replace(/Ãš/g, 'Ú')
        .replace(/Ãƒ/g, 'Ã')
        .replace(/Ã•/g, 'Õ')
        .replace(/Ã‡/g, 'Ç');
}

if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]), 'utf8');
}


function loadChamados() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        const chamados = JSON.parse(data);
        
        return chamados.map(ch => ({
            ...ch,
            nome: corrigirEncoding(ch.nome),
            setor: corrigirEncoding(ch.setor),
            descricao: corrigirEncoding(ch.descricao),
            status: corrigirEncoding(ch.status),
            responsavel: corrigirEncoding(ch.responsavel),
            fechadoPor: corrigirEncoding(ch.fechadoPor)
        }));
    } catch {
        return [];
    }
}


function saveChamados(data) {
    
    const dadosCorrigidos = data.map(ch => ({
        ...ch,
        nome: String(ch.nome),
        setor: String(ch.setor),
        descricao: String(ch.descricao),
        status: String(ch.status),
        responsavel: String(ch.responsavel),
        fechadoPor: String(ch.fechadoPor)
    }));
    
    fs.writeFileSync(DB_PATH, JSON.stringify(dadosCorrigidos, null, 2), 'utf8');
}


function verificarAutenticacao(req, res, next) {
    const token = req.headers.authorization;
    
    if (token === `Bearer ${SENHA_ADMIN}`) {
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


app.post("/api/abrir", (req, res) => {
    try {
        const chamados = loadChamados();
        const novoChamado = {
            id: Date.now(),
            nome: String(req.body.nome || ""),
            matricula: String(req.body.matricula || ""),
            ramal: String(req.body.ramal || ""),
            setor: String(req.body.setor || ""),
            descricao: String(req.body.descricao || ""),
            status: "Aberto",
            responsavel: "",
            fechadoPor: "",
            dataAbertura: new Date().toISOString()
        };
        chamados.push(novoChamado);
        saveChamados(chamados);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao abrir chamado" });
    }
});

// ========== ROTAS DO ADMIN (PROTEGIDAS) ==========

// Login
app.post("/api/login", (req, res) => {
    const { senha } = req.body;
    
    if (senha === SENHA_ADMIN) {
        res.json({ sucesso: true });
    } else {
        res.json({ sucesso: false, erro: "Senha incorreta" });
    }
});


app.get("/api/chamados", verificarAutenticacao, (req, res) => {
    try {
        res.json(loadChamados());
    } catch (err) {
        res.status(500).json({ erro: "Erro ao carregar" });
    }
});


app.post("/api/atualizar", verificarAutenticacao, (req, res) => {
    try {
        const chamados = loadChamados();
        const c = chamados.find(x => x.id === req.body.id);

        if (!c) return res.json({ erro: "Chamado não encontrado" });

        if (req.body.status) c.status = String(req.body.status);
        if (req.body.responsavel) c.responsavel = String(req.body.responsavel);
        if (req.body.fechadoPor) {
            c.fechadoPor = String(req.body.fechadoPor);
            c.dataFechamento = new Date().toISOString();
        }

        saveChamados(chamados);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar" });
    }
});


app.post("/api/excluir", verificarAutenticacao, (req, res) => {
    try {
        const chamados = loadChamados();
        const c = chamados.find(x => x.id === req.body.id);

        if (!c) return res.json({ erro: "Chamado não encontrado" });

        c.status = "Excluído";
        c.excluidoPor = String(req.body.excluidoPor || "Sistema");
        c.dataExclusao = new Date().toISOString();

        saveChamados(chamados);
        res.json({ sucesso: true });
    } catch (err) {
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

        saveChamados(chamados);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao restaurar" });
    }
});

// ========== INICIAR SERVIDOR ==========

app.listen(3000, () => {
    console.log("✅ Servidor rodando: http://localhost:3000");
    console.log("📝 Formulário público: http://localhost:3000");
    console.log("🔐 Login admin: http://localhost:3000/login");
    console.log("📊 Painel admin: http://localhost:3000/admin");
    console.log("🔑 Senha atual: " + SENHA_ADMIN);
    console.log("⚠️  ATENÇÃO: Mude a senha 'admin123' para uma mais segura!");
});