const { REST, Routes } = require("discord.js");

//info needed for slash commands
const botID = "1387326349542166608";
const serverID = "1325295363304853564";
const botToken = process.env.token;

const rest = new REST().setToken(botToken);

const slashRegister = async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(botID, serverID), {
      body: [
        {
          name: "ping",
          description: "Just a simple ping command, no less"
        },
        {
          name: "embed",
          description: "Sends an embed"
        },
        {
          name: "ticket-system",
          description: "makes a full Ticket system with purchase button"
        },
        {
          name: "embed-builder",
          description: "Create a custom embed with your own content",
          options: [
            {
              name: "title",
              description: "The title of your embed",
              type: 3,
              required: false
            },
            {
              name: "description",
              description: "The main description of your embed",
              type: 3,
              required: false
            },
            {
              name: "field1_name",
              description: "Name for field 1 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field1_value",
              description: "Description for field 1 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field2_name",
              description: "Name for field 2 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field2_value",
              description: "Description for field 2 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field3_name",
              description: "Name for field 3 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field3_value",
              description: "Description for field 3 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field4_name",
              description: "Name for field 4 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field4_value",
              description: "Description for field 4 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field5_name",
              description: "Name for field 5 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field5_value",
              description: "Description for field 5 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field6_name",
              description: "Name for field 6 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field6_value",
              description: "Description for field 6 (optional)",
              type: 3,
              required: false
            }
          ]
        },
        {
          name: "shop-embed-builder",
          description: "Create a custom shop embed with your own content",
          options: [
            {
              name: "title",
              description: "The title of your embed",
              type: 3,
              required: false
            },
            {
              name: "description",
              description: "The main description of your embed",
              type: 3,
              required: false
            },
            {
              name: "field1_name",
              description: "Name for field 1 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field1_value",
              description: "Description for field 1 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field2_name",
              description: "Name for field 2 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field2_value",
              description: "Description for field 2 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field3_name",
              description: "Name for field 3 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field3_value",
              description: "Description for field 3 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field4_name",
              description: "Name for field 4 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field4_value",
              description: "Description for field 4 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field5_name",
              description: "Name for field 5 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field5_value",
              description: "Description for field 5 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field6_name",
              description: "Name for field 6 (optional)",
              type: 3,
              required: false
            },
            {
              name: "field6_value",
              description: "Description for field 6 (optional)",
              type: 3,
              required: false
            }
          ]
        },
        {
          name: "send-rules",
          description: "Send the server rules embed to the designated channel"
        }
      ]
    });
    console.log("Successfully registered slash commands!");
  } catch (error) {
    console.error(error);
  }
};

slashRegister();

/*
Python Discord Bot Code for Ticket System:
Save this as a separate .py file to run the Python bot
*/