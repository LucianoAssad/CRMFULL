using System.Text.Json;
using System.Text.Json.Serialization;

namespace LeadChatHub.API;

/// <summary>
/// Allows JSON objects/arrays sent from the client to be deserialized into C# string properties
/// (e.g. Filtros = "{}", Variaveis = "[]", Metadata = "{}").
/// Without this, System.Text.Json throws when the JSON value is an object/array instead of a string literal.
/// </summary>
public class JsonObjectToStringConverter : JsonConverter<string>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Null => null,
            _ => JsonSerializer.Serialize(JsonDocument.ParseValue(ref reader).RootElement)
        };
    }

    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options)
        => writer.WriteStringValue(value);
}
