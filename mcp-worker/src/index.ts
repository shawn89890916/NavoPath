interface Env { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; MCP_SERVER_NAME: string }
type Json = Record<string, any>;
type Profile = { data: Json; settings: Json; updated_at: string };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const content = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const rpc = (id: unknown, result?: unknown, error?: { code: number; message: string }) => ({ jsonrpc: "2.0", id, ...(error ? { error } : { result }) });
const db = (env: Env, path: string, init?: RequestInit) => fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(init?.headers || {}) } });
async function sha256(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join(""); }
async function authenticate(request: Request, env: Env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); if (!token?.startsWith("nvp_")) return null;
  const query = await db(env, `navopath_mcp_tokens?select=id,user_id&token_hash=eq.${await sha256(token)}&revoked_at=is.null&limit=1`);
  const match = (await query.json() as Array<{ id: string; user_id: string }>)[0]; if (!match) return null;
  await db(env, `navopath_mcp_tokens?id=eq.${match.id}`, { method: "PATCH", body: JSON.stringify({ last_used_at: new Date().toISOString() }) }); return match.user_id;
}
async function profile(env: Env, userId: string) { const res = await db(env, `dayflow_profiles?select=data,settings,updated_at&user_id=eq.${userId}&limit=1`); const rows = await res.json() as Profile[]; if (!res.ok || !rows[0]) throw new Error("Workspace not found"); return rows[0]; }
async function save(env: Env, userId: string, original: Profile, patch: Partial<Profile>) { const res = await db(env, `dayflow_profiles?user_id=eq.${userId}&updated_at=eq.${encodeURIComponent(original.updated_at)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }); const rows = await res.json() as Profile[]; if (!res.ok || !rows[0]) throw new Error("Workspace changed concurrently; retry"); return rows[0]; }
const schema = (name: string, description: string, properties: Json = {}, required: string[] = []) => ({ name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } });
const tools = [
  schema("get_workspace_summary", "Return project, task, and event counts."), schema("list_projects", "List projects in display order."),
  schema("list_tasks", "List tasks with optional filters.", { projectId: { type: "string" }, completed: { type: "boolean" }, date: { type: "string" } }),
  schema("list_calendar", "List calendar items in an ISO date range.", { from: { type: "string" }, to: { type: "string" } }, ["from", "to"]),
  schema("create_project", "Create a project.", { title: { type: "string" }, notes: { type: "string" } }, ["title"]),
  schema("create_task", "Create a task in Planning or Today's Candidates.", { title: { type: "string" }, projectId: { type: "string" }, dueDate: { type: "string" }, estimatedMinutes: { type: "number" }, addToToday: { type: "boolean" } }, ["title"]),
  schema("update_task", "Edit, complete, move, or reorder a task.", { taskId: { type: "string" }, title: { type: "string" }, projectId: { type: ["string", "null"] }, dueDate: { type: "string" }, notes: { type: "string" }, completed: { type: "boolean" }, order: { type: "number" } }, ["taskId"]),
  schema("delete_task", "Delete a task.", { taskId: { type: "string" } }, ["taskId"]),
  schema("schedule_task", "Schedule a task.", { taskId: { type: "string" }, date: { type: "string" }, startTime: { type: "string" }, durationMinutes: { type: "number" } }, ["taskId", "date", "startTime", "durationMinutes"]),
  schema("unschedule_task", "Move a scheduled task to today or Planning.", { taskId: { type: "string" }, destination: { type: "string", enum: ["today", "planning"] } }, ["taskId", "destination"]),
  schema("get_settings", "Read safe display and planning settings."), schema("update_settings", "Update allowlisted settings.", { patch: { type: "object" } }, ["patch"]),
];
const allowedSettings = ["language","defaultTimelineView","planningView","theme","typographyStyle","executeAccentColor","planningAccentColor","hideCompleted","reminderLeadDays","taskNoteDisplay","aiTone","aiMemoryEnabled","hideAi"];
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const addMinutes = (time: string, amount: number) => { const [h,m] = time.split(":").map(Number); const total=h*60+m+amount; return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; };
async function execute(name: string, args: Json, env: Env, userId: string) {
  const current = await profile(env,userId), data=structuredClone(current.data), projects:Json[]=data.projects||[], tasks:Json[]=data.tasks||[], events:Json[]=data.events||[];
  if(name==="get_workspace_summary") return content({projects:projects.length,openTasks:tasks.filter(t=>!t.completed).length,completedTasks:tasks.filter(t=>t.completed).length,events:events.length});
  if(name==="list_projects") return content([...projects].sort((a,b)=>Number(a.order||0)-Number(b.order||0)));
  if(name==="list_tasks") return content(tasks.filter(t=>(!args.projectId||t.projectId===args.projectId)&&(typeof args.completed!=="boolean"||t.completed===args.completed)&&(!args.date||t.plannedForDate===args.date||t.dueDate===args.date)));
  if(name==="list_calendar") return content({events:events.filter(e=>String(e.date)>=args.from&&String(e.date)<=args.to),tasks:tasks.flatMap(t=>(t.timelineRecords||[]).filter((r:Json)=>String(r.scheduledDate)>=args.from&&String(r.scheduledDate)<=args.to).map((r:Json)=>({taskId:t.id,title:t.title,...r})))});
  if(name==="get_settings") return content(Object.fromEntries(allowedSettings.map(k=>[k,current.settings[k]])));
  if(name==="update_settings"){const patch=Object.fromEntries(Object.entries(args.patch||{}).filter(([k])=>allowedSettings.includes(k)));const saved=await save(env,userId,current,{settings:{...current.settings,...patch}});return content(Object.fromEntries(allowedSettings.map(k=>[k,saved.settings[k]])));}
  const now=new Date().toISOString();
  if(name==="create_project"){const item={id:uid("project"),title:String(args.title),category:"project",notes:args.notes||"",completed:false,order:projects.length,createdAt:now,updatedAt:now};data.projects=[...projects,item];await save(env,userId,current,{data});return content(item);}
  if(name==="create_task"){const item={id:uid("task"),title:String(args.title),projectId:args.projectId,dueDate:args.dueDate||today(),category:"personal",priority:"medium",notes:"",goalId:"",completed:false,estimatedHours:Number(args.estimatedMinutes||30)/60,order:tasks.length,plannedForDate:args.addToToday?today():undefined,executionLane:args.addToToday?"candidate":undefined,timelineRecords:[],createdAt:now,updatedAt:now};data.tasks=[...tasks,item];await save(env,userId,current,{data});return content(item);}
  const index=tasks.findIndex(t=>t.id===args.taskId);if(index<0)throw new Error("Task not found");if(name==="delete_task"){data.tasks=tasks.filter(t=>t.id!==args.taskId);await save(env,userId,current,{data});return content({deleted:args.taskId});}
  let next:Json={...tasks[index],updatedAt:now};if(name==="update_task")next={...next,...Object.fromEntries(Object.entries(args).filter(([k])=>["title","projectId","dueDate","notes","completed","order"].includes(k)))};
  if(name==="schedule_task"){const record={id:uid("record"),taskId:next.id,scheduledDate:args.date,scheduledStart:args.startTime,scheduledEnd:addMinutes(args.startTime,Number(args.durationMinutes)),executionStatus:"scheduled",createdAt:now};next={...next,plannedForDate:args.date,executionLane:undefined,estimatedHours:Number(args.durationMinutes)/60,timelineRecords:[...(next.timelineRecords||[]),record]};}
  if(name==="unschedule_task")next={...next,plannedForDate:args.destination==="today"?today():undefined,executionLane:args.destination==="today"?"candidate":undefined,scheduledDate:undefined,scheduledStart:undefined,scheduledEnd:undefined,timelineRecords:(next.timelineRecords||[]).filter((r:Json)=>r.executionStatus==="completed")};
  data.tasks=tasks.map((t,i)=>i===index?next:t);await save(env,userId,current,{data});return content(next);
}
export default { async fetch(request:Request,env:Env){const url=new URL(request.url);if(url.pathname==="/")return response({name:env.MCP_SERVER_NAME,endpoint:"/mcp"});if(url.pathname!=="/mcp")return new Response("Not found",{status:404});if(request.method==="DELETE")return new Response(null,{status:204});if(request.method!=="POST")return new Response("Method not allowed",{status:405});const userId=await authenticate(request,env);if(!userId)return response({error:"Invalid or revoked bearer token"},401);const body=await request.json() as Json;if(!body.id&&String(body.method).startsWith("notifications/"))return new Response(null,{status:202});if(body.method==="initialize")return response(rpc(body.id,{protocolVersion:"2025-11-25",capabilities:{tools:{listChanged:false}},serverInfo:{name:env.MCP_SERVER_NAME,version:"1.0.0"}}));if(body.method==="ping")return response(rpc(body.id,{}));if(body.method==="tools/list")return response(rpc(body.id,{tools}));if(body.method==="tools/call"){try{return response(rpc(body.id,await execute(String(body.params?.name),body.params?.arguments||{},env,userId)))}catch(reason){return response(rpc(body.id,undefined,{code:-32000,message:reason instanceof Error?reason.message:"Tool failed"}))}}return response(rpc(body.id,undefined,{code:-32601,message:"Method not found"}));} };
