var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();

app.MapGet("/", () => Results.Ok(new { name = "Dijital Ajanda API", mail = "Supabase Edge Functions (mail-welcome, mail-reminder-digest)" }));
app.MapGet("/api/health", () => Results.Ok(new { ok = true }));

app.Run();
