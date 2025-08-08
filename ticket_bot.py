
import discord
from discord.ext import commands
from discord import app_commands
import os

intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

GUILD_ID = 1325295363304853564  # Replace with your server ID
CATEGORY_ID = 1333688858638024736  # Replace with your ticket category ID

class TicketView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="💰 Purchase", style=discord.ButtonStyle.primary, custom_id="purchase_button", emoji="🛒")
    async def purchase(self, interaction: discord.Interaction, button: discord.ui.Button):
        # (your original ticket creation code here)
        ...

    @discord.ui.button(label="🌐 Purchase from Website", style=discord.ButtonStyle.link, url="https://sevservices.mysellauth.com/", emoji="🔗")
    async def purchase_website(self, button: discord.ui.Button, interaction: discord.Interaction):
        pass  # Link buttons don’t need logic, they just redirect

        
        # Check if user already has a ticket
        existing_channel = discord.utils.get(guild.text_channels, name=f"ticket-{interaction.user.name}".replace(" ", "-").lower())
        if existing_channel:
            await interaction.response.send_message(f"❌ You already have an open ticket: {existing_channel.mention}", ephemeral=True)
            return

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            interaction.user: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
            guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_messages=True)
        }

        channel = await guild.create_text_channel(
            name=f"ticket-{interaction.user.name}".replace(" ", "-").lower(),
            overwrites=overwrites,
            category=category,
            topic=f"Ticket created by {interaction.user.name} ({interaction.user.id})"
        )

        # Create welcome embed for the ticket
        welcome_embed = discord.Embed(
            title="🎫 Welcome to your Purchase Ticket",
            description=f"Hello {interaction.user.mention}!\n\nThank you for your interest in our premium services. Our support team will assist you shortly.\n\n**Please describe:**\n• What product you'd like to purchase\n• Any specific questions you have\n• Your payment method preference",
            color=0x8A2BE2  # Purple color
        )
        welcome_embed.add_field(
            name="💎 Premium R6 Lua – $8",
            value="• Supports all operators and guns\n• Built-in config system\n• 100% undetected\n• Compatible with Logitech mice",
            inline=False
        )
        welcome_embed.set_footer(text="Support Team • Response time: Usually within 1 hour")
        welcome_embed.set_thumbnail(url=interaction.user.display_avatar.url)

        close_view = CloseTicketView()
        await channel.send(embed=welcome_embed, view=close_view)
        await interaction.response.send_message(f"🎟️ Ticket created successfully: {channel.mention}", ephemeral=True)

class CloseTicketView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
    
    @discord.ui.button(label="🔒 Close Ticket", style=discord.ButtonStyle.danger, custom_id="close_ticket")
    async def close_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not interaction.user.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ You don't have permission to close tickets.", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="🔒 Ticket Closed",
            description=f"This ticket has been closed by {interaction.user.mention}.\nChannel will be deleted in 5 seconds.",
            color=0xFF0000
        )
        await interaction.response.send_message(embed=embed)
        
        import asyncio
        await asyncio.sleep(5)
        await interaction.followup.channel.delete()

@bot.event
async def on_ready():
    try:
        # Add persistent views
        bot.add_view(TicketView())
        bot.add_view(CloseTicketView())
        
        synced = await bot.tree.sync(guild=discord.Object(id=GUILD_ID))
        print(f"✅ Logged in as {bot.user}")
        print(f"📡 Synced {len(synced)} command(s)")
    except Exception as e:
        print(f"❌ Failed to sync commands: {e}")

@bot.tree.command(name="ticket_system", description="Creates a ticket system with purchase button", guild=discord.Object(id=GUILD_ID))
async def ticket_system(interaction: discord.Interaction):
    # Create the main embed with purple-blue gradient effect
    embed = discord.Embed(
        title="🎫 Purchase Support System",
        description="Ready to upgrade your gaming experience? Click the button below to open a purchase ticket and get started!",
        color=0x4B0082  # Indigo (purple-blue mix)
    )
    
    embed.add_field(
        name="💎 What We Offer",
        value="• **Premium R6 Lua Script** - $8\n• **24/7 Customer Support**\n• **Instant Delivery**\n• **Lifetime Updates**",
        inline=True
    )
    
    embed.add_field(
        name="🛡️ Why Choose Us?",
        value="• **100% Undetected**\n• **Easy Setup**\n• **Professional Support**\n• **Trusted by 1000+ Users**",
        inline=True
    )
    
    embed.add_field(
        name="💳 Payment Methods",
        value="• PayPal\n• Cryptocurrency\n• Bank Transfer\n• Gift Cards",
        inline=False
    )
    
    embed.set_footer(text="🔥 Limited Time Offer - Get Premium Access Today!", icon_url=bot.user.display_avatar.url)
    embed.set_thumbnail(url="https://cdn.discordapp.com/attachments/123456789/123456789/premium_logo.png")  # Replace with your logo
    
    # Add a field with gradient-like colors using Unicode blocks
    embed.add_field(
        name="🌈 Experience the Difference",
        value="```ansi\n\u001b[0;35m██\u001b[0;34m██\u001b[0;35m PREMIUM QUALITY \u001b[0;34m██\u001b[0;35m██\u001b[0m\n```",
        inline=False
    )
    
    view = TicketView()
    await interaction.response.send_message(embed=embed, view=view)

@bot.tree.command(name="close_all_tickets", description="Closes all open tickets (Admin only)", guild=discord.Object(id=GUILD_ID))
async def close_all_tickets(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ You need administrator permissions to use this command.", ephemeral=True)
        return
    
    guild = interaction.guild
    category = discord.utils.get(guild.categories, id=CATEGORY_ID)
    
    if not category:
        await interaction.response.send_message("❌ Ticket category not found.", ephemeral=True)
        return
    
    ticket_channels = [channel for channel in category.channels if channel.name.startswith("ticket-")]
    
    if not ticket_channels:
        await interaction.response.send_message("✅ No open tickets found.", ephemeral=True)
        return
    
    await interaction.response.send_message(f"🔒 Closing {len(ticket_channels)} ticket(s)...", ephemeral=True)
    
    for channel in ticket_channels:
        try:
            await channel.delete()
        except:
            pass
    
    await interaction.followup.send(f"✅ Successfully closed {len(ticket_channels)} ticket(s).", ephemeral=True)

# Run the bot
if __name__ == "__main__":
    bot.run(os.getenv('token'))
