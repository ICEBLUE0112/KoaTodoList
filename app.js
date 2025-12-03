const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static'); // [新增] 引入静态资源服务模块
const fs = require('fs').promises;
const path = require('path');

const app = new Koa();
const router = new Router();

// 定义数据文件路径
const DB_PATH = path.join(__dirname, 'todos.json');

// --- 辅助函数：文件读写 ---

// 初始化数据文件
async function initDB() {
    try {
        await fs.access(DB_PATH);
    } catch (error) {
        await fs.writeFile(DB_PATH, JSON.stringify([]));
    }
}

// 读取 Todo 列表
async function readTodos() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        return [];
    }
}

// 写入 Todo 列表
async function writeTodos(todos) {
    await fs.writeFile(DB_PATH, JSON.stringify(todos, null, 2));
}

// --- 中间件配置 ---

// 1. 解析请求体
app.use(bodyParser());

// 2. [新增] 托管静态文件
// 当用户访问根路径 '/' 时，Koa 会自动查找 public/index.html 并返回
app.use(serve(path.join(__dirname, 'public')));

// --- API 路由逻辑 ---

/**
 * GET /api/todos
 * 获取所有任务
 */
router.get('/api/todos', async (ctx) => {
    const todos = await readTodos();
    ctx.body = todos;
});

/**
 * POST /api/todos
 * 创建新任务
 */
router.post('/api/todos', async (ctx) => {
    const { title, completed } = ctx.request.body;

    if (!title) {
        ctx.status = 400;
        ctx.body = { error: 'Title is required' };
        return;
    }

    const todos = await readTodos();

    const newTodo = {
        id: Date.now().toString(),
        title,
        completed: completed || false,
        createdAt: new Date().toISOString()
    };

    todos.push(newTodo);
    await writeTodos(todos);

    ctx.status = 201;
    ctx.body = newTodo;
});

/**
 * PUT /api/todos/:id
 * 更新任务
 */
router.put('/api/todos/:id', async (ctx) => {
    const id = ctx.params.id;
    const { title, completed } = ctx.request.body;

    const todos = await readTodos();
    const todoIndex = todos.findIndex(t => t.id === id);

    if (todoIndex === -1) {
        ctx.status = 404;
        ctx.body = { error: 'Todo not found' };
        return;
    }

    const updatedTodo = {
        ...todos[todoIndex],
        ...(title !== undefined && { title }),
        ...(completed !== undefined && { completed })
    };

    todos[todoIndex] = updatedTodo;
    await writeTodos(todos);

    ctx.body = updatedTodo;
});

/**
 * DELETE /api/todos/:id
 * 删除任务
 */
router.delete('/api/todos/:id', async (ctx) => {
    const id = ctx.params.id;
    let todos = await readTodos();

    const initialLength = todos.length;
    todos = todos.filter(t => t.id !== id);

    if (todos.length === initialLength) {
        ctx.status = 404;
        ctx.body = { error: 'Todo not found' };
        return;
    }

    await writeTodos(todos);

    ctx.status = 204;
});

// --- 启动服务器 ---

// 注册路由
app.use(router.routes()).use(router.allowedMethods());

// 初始化并监听
initDB().then(() => {
    app.listen(3000, () => {
        console.log('Server is running at http://localhost:3000');
    });
});