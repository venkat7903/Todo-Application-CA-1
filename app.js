const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { format, isValid } = require("date-fns");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, "todoApplication.db");
let db = null;

const initiateDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initiateDBAndServer();

const convertToCamelCase = (data) => ({
  id: data.id,
  todo: data.todo,
  category: data.category,
  priority: data.priority,
  status: data.status,
  dueDate: data.due_date,
});

const validStatus = ["TO DO", "IN PROGRESS", "DONE"];
const validPriority = ["HIGH", "MEDIUM", "LOW"];
const validCategory = ["WORK", "HOME", "LEARNING"];

const hasStatus = (requestQuery) => {
  return (
    requestQuery.status !== undefined &&
    validStatus.includes(requestQuery.status)
  );
};

const hasPriority = (requestQuery) => {
  return (
    requestQuery.priority !== undefined &&
    validPriority.includes(requestQuery.priority)
  );
};

const hasCategory = (requestQuery) => {
  return (
    requestQuery.category !== undefined &&
    validCategory.includes(requestQuery.category)
  );
};

const hasPriorityAndStatus = (requestQuery) => {
  return requestQuery.priority && requestQuery.status;
};

const hasPriorityAndCategory = (requestQuery) => {
  return requestQuery.priority && requestQuery.category;
};

const hasCategoryAndStatus = (requestQuery) => {
  return requestQuery.category && requestQuery.status;
};

const hasSearch = (requestQuery) => {
  return requestQuery.search_q !== undefined;
};

//API1
app.get("/todos/", async (request, response) => {
  let getTodoQuery;
  const requestQuery = request.query;
  const { status, priority, category, search_q } = requestQuery;

  switch (true) {
    case hasStatus(requestQuery):
      getTodoQuery = `
          SELECT * FROM todo WHERE status='${status}';
          `;
      break;

    case hasPriority(requestQuery):
      getTodoQuery = `SELECT * FROM todo WHERE  priority='${priority}';`;
      break;

    case hasCategory(requestQuery):
      getTodoQuery = `SELECT * FROM todo WHERE   category='${category}';`;
      break;

    case hasPriorityAndStatus(requestQuery):
      getTodoQuery = `SELECT * FROM todo WHERE  status='${status}' AND priority='${priority}'`;
      break;

    case hasPriorityAndCategory(requestQuery):
      getTodoQuery = `SELECT * FROM todo WHERE  category='${category}' AND priority='${priority}'`;
      break;
    case hasCategoryAndStatus(requestQuery):
      getTodoQuery = `SELECT * FROM todo WHERE  category='${category}' AND status='${status}'`;
      break;
    case hasSearch(requestQuery):
      getTodoQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%'`;
      break;
    case JSON.stringify(requestQuery) === "{}":
      getTodoQuery = `SELECT * FROM todo`;
      break;
  }

  let query;

  switch (true) {
    case requestQuery.status !== undefined:
      query = "Status";
      break;
    case requestQuery.category !== undefined:
      query = "Category";
      break;
    case requestQuery.priority !== undefined:
      query = "Priority";
      break;
  }

  if (getTodoQuery === undefined) {
    response.status(400);
    response.send(`Invalid Todo ${query}`);
  } else {
    const todoArray = await db.all(getTodoQuery);
    response.send(todoArray.map((each) => convertToCamelCase(each)));
  }
});

//API2
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodo = `
  SELECT * FROM todo WHERE id=${todoId};
  `;
  const todo = await db.get(getTodo);
  response.send(convertToCamelCase(todo));
});

//API3
app.get("/agenda/", async (request, response) => {
  const { date } = request.query;
  const newDate = new Date(date);

  if (!isValid(newDate)) {
    response.status(400);
    response.send("Invalid Due Date");
  } else {
    const formattedDate = format(new Date(date), "yyyy-MM-dd");
    const getTodo = `
      SELECT * FROM todo WHERE due_date='${formattedDate}';
      `;
    const todoArray = await db.all(getTodo);
    response.send(todoArray.map((each) => convertToCamelCase(each)));
  }
});

//API4
app.post("/todos/", async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;

  switch (true) {
    case !validStatus.includes(status):
      response.status(400);
      response.send("Invalid Todo Status");
      break;
    case !validPriority.includes(priority):
      response.status(400);
      response.send("Invalid Todo Priority");
      break;
    case !validCategory.includes(category):
      response.status(400);
      response.send("Invalid Todo Category");
      break;
    case !isValid(new Date(dueDate)):
      response.status(400);
      response.send("Invalid Due Date");
      break;
  }

  if (response.statusCode !== 400) {
    const formattedDate = format(new Date(dueDate), "yyyy-MM-dd");
    const createTodo = `
    INSERT INTO todo (id, todo, priority, status, category, due_date)
    VALUES (${id}, '${todo}', '${priority}', '${status}', '${category}', '${formattedDate}');
    `;
    await db.run(createTodo);
    response.send("Todo Successfully Added");
  }
});

//API5
app.put("/todos/:todoId", async (request, response) => {
  const { todoId } = request.params;
  const getCurrentTodo = `
  SELECT * 
  FROM 
    todo
  WHERE 
    id=${todoId};
  `;
  const currentTodo = await db.get(getCurrentTodo);
  const requestBody = request.body;
  const {
    todo = currentTodo.todo,
    priority = currentTodo.priority,
    status = currentTodo.status,
    category = currentTodo.category,
    dueDate = currentTodo.dueDate,
  } = requestBody;
  let updatedColumn;

  switch (true) {
    case requestBody.status !== undefined:
      updatedColumn = "Status";
      if (!validStatus.includes(requestBody.status)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
      break;
    case requestBody.priority !== undefined:
      updatedColumn = "Priority";
      if (!validPriority.includes(requestBody.priority)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
      break;
    case requestBody.category !== undefined:
      updatedColumn = "Category";
      if (!validCategory.includes(requestBody.category)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
      break;
    case requestBody.dueDate !== undefined:
      updatedColumn = "Due Date";
      if (!isValid(new Date(requestBody.dueDate))) {
        response.status(400);
        response.send(`Invalid ${updatedColumn}`);
      }
      break;
    case requestBody.todo !== undefined:
      updatedColumn = "Todo";
      break;
  }

  if (response.statusCode !== 400) {
    const updateQuery = `
    UPDATE todo
    SET 
        todo='${todo}',
        priority='${priority}',
        status='${status}',
        category='${category}',
        due_date='${dueDate}'
    WHERE 
        id=${todoId};
    `;
    await db.run(updateQuery);
    response.send(`${updatedColumn} Updated`);
  }
});

//API6
app.delete("/todos/:todoId", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodo = `
  DELETE FROM todo
  WHERE id=${todoId};
  `;
  await db.run(deleteTodo);
  response.send("Todo Deleted");
});

module.exports = app;
