using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LeadChatHub.API.Hubs;

/// <summary>
/// SignalR Hub for real-time messaging and conversation updates.
/// Clients join groups based on empresa_id to receive relevant updates.
/// </summary>
[Authorize]
public class ChatHub : Hub
{
    /// <summary>
    /// Join a company group to receive real-time updates for that empresa.
    /// </summary>
    public async Task JoinEmpresa(string empresaId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"empresa_{empresaId}");
    }

    /// <summary>
    /// Leave a company group.
    /// </summary>
    public async Task LeaveEmpresa(string empresaId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"empresa_{empresaId}");
    }

    /// <summary>
    /// Join a specific conversation group for fine-grained message updates.
    /// </summary>
    public async Task JoinConversa(string conversaId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"conversa_{conversaId}");
    }

    /// <summary>
    /// Leave a conversation group.
    /// </summary>
    public async Task LeaveConversa(string conversaId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversa_{conversaId}");
    }

    public override async Task OnConnectedAsync()
    {
        var empresaId = Context.User?.FindFirst("empresa_id")?.Value;
        if (!string.IsNullOrEmpty(empresaId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"empresa_{empresaId}");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}

/// <summary>
/// Helper extension methods for broadcasting events from services/controllers.
/// </summary>
public static class ChatHubExtensions
{
    public static async Task NotifyNewMessage(this IHubContext<ChatHub> hub, Guid empresaId, Guid conversaId, object message)
    {
        await hub.Clients.Group($"empresa_{empresaId}").SendAsync("NewMessage", message);
        await hub.Clients.Group($"conversa_{conversaId}").SendAsync("NewMessage", message);
    }

    public static async Task NotifyConversaUpdated(this IHubContext<ChatHub> hub, Guid empresaId, object conversa)
    {
        await hub.Clients.Group($"empresa_{empresaId}").SendAsync("ConversaUpdated", conversa);
    }

    public static async Task NotifyLeadUpdated(this IHubContext<ChatHub> hub, Guid empresaId, object lead)
    {
        await hub.Clients.Group($"empresa_{empresaId}").SendAsync("LeadUpdated", lead);
    }
}
