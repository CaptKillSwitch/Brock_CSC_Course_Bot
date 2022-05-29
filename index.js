const {
  Client,
  Constants,
  Intents,
  MessageActionRow,
  MessageButton,
  Permissions,
  MessageEmbed,
  MessageAttachment,
} = require("discord.js");
const { clientId, token } = require("./config.json");
const axios = require("axios");
const cheerio = require("cheerio");
const progressbar = require("string-progressbar");
const filter = new (require("bad-words-relaxed"))();
const guildsArray = [];
const user_roles_request = {};
const emojies = [
  "https://cdn3.emoji.gg/emojis/3351-pepe-swat.png",
  "https://cdn3.emoji.gg/emojis/3049-pepenosign.png",
  "https://cdn3.emoji.gg/emojis/6308-gahammer.gif",
  "https://cdn3.emoji.gg/emojis/7563-hammertime.gif",
  "https://cdn3.emoji.gg/emojis/7451-pepegunr.png",
  "https://cdn3.emoji.gg/emojis/4446-peeporules.png",
  "https://cdn3.emoji.gg/emojis/4917-getsomehelp.gif",
  "https://cdn3.emoji.gg/emojis/2283-blobstop.png",
  "https://cdn3.emoji.gg/emojis/4938-robut-stop.png",
  "https://cdn3.emoji.gg/emojis/9107-policestop.png",
  "https://cdn3.emoji.gg/emojis/6892-arnoldstop.png",
  "https://cdn3.emoji.gg/emojis/1125-ayooooooo.gif",
];
Array.prototype.random = function () {
  return this[Math.floor(Math.random() * this.length)];
};

const error = (...args) => {
  console.log("\x1b[31m", ...args);
};

const success = (...args) => {
  console.log("\x1b[32m", ...args);
};

const info = (...args) => {
  console.log("\x1b[33m", ...args);
};

function generatePages(roles) {
  const guild_pages = [];
  let rows = [];
  let current_button_row_index = 0;
  const button_row_limit = 4;
  let current_button_index = 0;
  const button_limit = 5;
  let page_number = 0;
  let messageRow = [];
  roles.forEach((role) => {
    if (current_button_index >= button_limit) {
      rows.push(messageRow);
      messageRow = [];
      current_button_index = 0;
      current_button_row_index++;
    }
    if (current_button_row_index >= button_row_limit) {
      messageRow = [];
      if (page_number !== 0) {
        messageRow.push(
          new MessageButton()
            .setCustomId("primary")
            .setLabel("Previous")
            .setStyle("SECONDARY")
            .setCustomId("previous")
        );
      }
      messageRow.push(
        new MessageButton()
          .setCustomId("primary")
          .setLabel("Next")
          .setStyle("SECONDARY")
          .setCustomId("next")
      );
      rows.push(messageRow);
      guild_pages.push(rows);
      rows = [];
      messageRow = [];
      current_button_row_index = 0;
      page_number++;
    }
    messageRow.push(
      new MessageButton()
        .setCustomId("primary")
        .setLabel(role.name)
        .setStyle(role.belongs_to_user ? "SUCCESS" : "SECONDARY")
        .setCustomId(role.id)
    );
    current_button_index++;
  });
  rows.push(messageRow);
  rows.push([
    new MessageButton()
      .setCustomId("primary")
      .setLabel("Previous")
      .setStyle("SECONDARY")
      .setCustomId("previous"),
  ]);

  guild_pages.push(rows);
  return guild_pages;
}

function get_page(user_id) {
  const page = [];
  user_roles_request[user_id]["pages"][
    user_roles_request[user_id]["index"]
  ].forEach((msg_row) => {
    const row = new MessageActionRow();
    msg_row.forEach((msg) => row.addComponents(msg));
    page.push(row);
  });
  return page;
}

function update_button(user_id, updated_button) {
  let pages = user_roles_request[user_id]["pages"];
  pages.forEach((page) => {
    page.forEach((row) => {
      let button_index = row.findIndex((button) => {
        return button.customId === updated_button.customId;
      });
      if (button_index > -1) {
        row[button_index] = updated_button;
      }
    });
  });
}

function loadCommands(commands, commandsObj) {
  commands.forEach((command) => {
    commandsObj.create(command);
  });
}

async function scrapeUrl(url, degree_name, degree_identifier) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    let found_degree = false;
    const courses = $(
      $(
        $($("#calendarcontent").children().children().get().splice(-2)[0])
      ).get()
    )
      .text()
      .split("\n")
      .filter((text) => {
        if (!found_degree && text.includes(degree_name)) {
          found_degree = true;
        }
        return found_degree && text.trim().length > 0;
      });
    let role;
    let description;
    const processed_data = [];
    courses.forEach((course_data) => {
      course_data = course_data
        .replace("            ", "")
        .replace("*", "")
        .replace("#", "");
      if (course_data.includes(degree_identifier) && course_data.length <= 10) {
        if (role !== undefined) {
          processed_data.push({
            role: role,
            channel_name: role.toLowerCase().trim().replace(" ", "-"),
            description:
              description.length > 1000
                ? description.slice(0, 1000) + "..."
                : description,
          });
        }
        role = course_data;
        description = "";
      } else {
        description += course_data + "\n";
      }
    });
    return processed_data;
  } catch (err) {
    console.error(err);
    return {};
  }
}

async function start() {
  let commands;
  if (token !== undefined) {
    if (clientId !== undefined) {
      const client = new Client({
        intents: [
          Intents.FLAGS.GUILDS,
          Intents.FLAGS.GUILD_MESSAGES,
          Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        ],
      });
      try {
        commands = [
          {
            name: "scrape",
            description:
              "Scrapes and loads courses from Undergrad Csc Calendar. Options are Case sensitive.",
            options: [
              {
                name: "url",
                description:
                  "Brock calendar degree link. Leave blank for using the Csc 2022 calendar.",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
              },
              {
                name: "degree_name",
                description:
                  "Before course description, degree name is written. Leave blank for COMPUTER SCIENCE COURSES.",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
              },
              {
                name: "degree_identifier",
                description:
                  "Every degree has a 4 letter identifier. Leave blank for COSC",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
              },
            ],
            userPermissions: ["ADMINISTRATOR"],
          },
          {
            name: "create_channel",
            description:
              "Creates a new channel, channel description and role with the name given.",
            options: [
              {
                name: "channel_name",
                description: "Channel name",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: true,
              },
              {
                name: "channel_description",
                description: "Topic for the channel. Leave it empty if none.",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
              },
              {
                name: "channel_category",
                description:
                  "Category to create channels under. Leave empty if none.",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
              },
            ],
            userPermissions: ["ADMINISTRATOR"],
          },
          {
            name: "roles",
            description:
              "Add or remove roles. Leave filter empty to get all roles.",
            options: [
              {
                name: "degree_identifier",
                description: "Example cosc, math...",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
              },
            ],
          },
          {
            name: "lock",
            description: "Locks channel/all channels except general. ",
            options: [
              {
                name: "channel_name",
                description:
                  "Enter the channel, category name. Leave this empty if you want to lock down all channels.",
                type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                required: false,
              },
            ],
            userPermissions: ["ADMINISTRATOR"],
          },
          {
            name: "unlock",
            description: "Unlocks channel/all channels except general. ",
            options: [
              {
                name: "channel_name",
                description:
                  "Enter the channel, category name. Leave this empty if you want to lock down all channels.",
                type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                required: false,
              },
            ],
            userPermissions: ["ADMINISTRATOR"],
          },
          {
            name: "sync",
            description: "Syncs all channel's permissions to it's category.",
            userPermissions: ["ADMINISTRATOR"],
          },
        ];
        client.once("ready", async () => {
          for (const guild of await client.guilds.fetch()) {
            guildsArray.push(client.guilds.cache.get(guild[0]));
          }
          let command;
          if (guildsArray.length > 0) {
            info("Found the following guilds: ");
            for (const guild of guildsArray) {
              command = guild.commands;
              loadCommands(commands, command);
              info(guild.name, guild.id);
            }
            success("Commands loaded successfully.");
          } else {
            error(
              "Unable to fetch guilds. Settings commands to client instead."
            );
            command = client.commands;
            loadCommands(commands, command);
            success("Commands loaded successfully.");
          }
          success("Bot ready to work!");
        });
        client.on("interactionCreate", async (interaction) => {
          if (interaction.isCommand()) {
            const { commandName, options, user, guild, member } = interaction;
            switch (commandName) {
              case "scrape": {
                if (member.permissions.serialize().ADMINISTRATOR) {
                  let url =
                    options.getString("url") !== null
                      ? options.getString("url")
                      : "https://brocku.ca/webcal/2022/undergrad/cosc.html";
                  let degree_name =
                    options.getString("degree_name") !== null
                      ? options.getString("degree_name")
                      : "COMPUTER SCIENCE COURSES";
                  let degree_identifier =
                    options.getString("degree_identifier") !== null
                      ? options.getString("degree_identifier")
                      : "COSC";

                  await interaction.deferReply({ content: "bot is scraping" });
                  const data = await scrapeUrl(
                    url,
                    degree_name,
                    degree_identifier
                  );
                  const current_channels = await guild.channels.fetch();
                  const current_roles = await guild.roles.fetch();
                  const changes = [];

                  // @ts-ignore
                  data.forEach((course) => {
                    changes.push({
                      role_name: course["role"],
                      channel_name: course["channel_name"],
                      role: current_roles.find(
                        (role) => role.name === course["role"]
                      ),
                      channel: current_channels.find(
                        (channel) => channel.name === course["channel_name"]
                      ),
                      description: course["description"],
                    });
                  });
                  let change_msg = "";
                  changes.forEach((change) => {
                    if (change["role"] === undefined) {
                      change_msg +=
                        "Create role: " + change["role_name"] + "\n";
                    }
                    if (change["channel"] === undefined) {
                      change_msg +=
                        "Create channel: " + change["channel_name"] + "\n";
                    } else {
                      change_msg +=
                        "Update description for channel: " +
                        change["channel_name"] +
                        "\n";
                    }
                  });
                  change_msg =
                    change_msg.length < 1200
                      ? change_msg
                      : change_msg.slice(0, 1197);
                  change_msg += "...\n";
                  const message = await interaction.editReply({
                    content:
                      "The flowing changes will be made. \n" +
                      change_msg +
                      "Press tick to accept changes and cross to discard changes.",
                  });
                  Promise.all([message.react("✅"), message.react("❌")])
                    .then(() => {
                      const filter = (reaction, usr) => {
                        return (
                          ["✅", "❌"].includes(reaction.emoji.name) &&
                          usr.id === user.id
                        );
                      };
                      message
                        .awaitReactions({ filter, maxEmojis: 1 })
                        .then((collected) => {
                          const reaction = collected.first();
                          if (reaction.emoji.name === "✅") {
                            message.reply({ content: "Implementing changes" });
                            changes.forEach((change) => {
                              if (change["role"] === undefined) {
                                guild.roles
                                  .create({
                                    name: change["role_name"],
                                  })
                                  .catch((err) => {
                                    error(err);
                                    message.reply({
                                      content:
                                        "Failed to create role " +
                                        change["role_name"],
                                    });
                                  });
                              }
                              if (change["channel"] === undefined) {
                                guild.channels
                                  .create(change["channel_name"], {
                                    type: "GUILD_TEXT",
                                    topic: change["description"],
                                  })
                                  .catch((err) => {
                                    error(err);
                                    message.reply({
                                      content:
                                        "Failed to create channel: " +
                                        change["channel_name"],
                                    });
                                  });
                              } else {
                                guild.channels
                                  .edit(change["channel"].id, {
                                    topic: change["description"],
                                  })
                                  .catch((err) => {
                                    error(err);
                                    message.reply({
                                      content:
                                        "Failed to edit channel: " +
                                        change["channel_name"],
                                    });
                                  });
                              }
                            });
                            message.reply({ content: "Task done." });
                          } else {
                            message.reply({ content: "Changes cancelled" });
                          }
                        })
                        .catch((collected) => {
                          error(collected);
                          message.reply(
                            "Could not process the request, discarding changes."
                          );
                        });
                    })
                    .catch((e) => {
                      error(e.message);
                      interaction.editReply({
                        content:
                          'Failed to add confirmation emojis "✅" "❌". Discarding changes.',
                      });
                    });
                } else {
                  await interaction.reply({
                    content: "You are not allowed to use this command.",
                    ephemeral: false,
                  });
                }
                return;
              }
              case "create_channel": {
                if (member.permissions.serialize().ADMINISTRATOR) {
                  const channels = await guild.channels.fetch();
                  const channel_name = options.getString("channel_name");
                  const channel_description = options.getString(
                    "channel_description"
                  );
                  const category_name = options.getString("channel_category");
                  let category;
                  if (category_name !== null) {
                    category = channels.find((value) => {
                      return (
                        value.type === "GUILD_CATEGORY" &&
                        value.name.toLowerCase() === category_name.toLowerCase()
                      );
                    });
                  }

                  const new_channel = await guild.channels.create(
                    channel_name,
                    {
                      type: "GUILD_TEXT",
                    }
                  );
                  if (channel_description !== null) {
                    await guild.channels.edit(new_channel.id, {
                      topic: channel_description,
                    });
                  }
                  if (category_name !== null) {
                    if (category !== undefined) {
                      await guild.channels.edit(new_channel.id, {
                        parent: category.id,
                      });
                    } else {
                      const new_category_confirmation_message =
                        await interaction.reply({
                          content:
                            "Did not find category named: " +
                            category_name +
                            " If you want to create a new category click on ✅ or click on ❌",
                          fetchReply: true,
                        });
                      Promise.all([
                        new_category_confirmation_message.react("✅"),
                        new_category_confirmation_message.react("❌"),
                      ])
                        .then(() => {
                          const filter = (reaction, usr) => {
                            return (
                              ["✅", "❌"].includes(reaction.emoji.name) &&
                              usr.id === user.id
                            );
                          };
                          new_category_confirmation_message
                            .awaitReactions({ filter, maxEmojis: 1 })
                            .then(async (collected) => {
                              const reaction = collected.first();
                              if (reaction.emoji.name === "✅") {
                                category = await guild.channels.create(
                                  category_name,
                                  {
                                    type: "GUILD_CATEGORY",
                                  }
                                );
                                await guild.channels.edit(new_channel.id, {
                                  parent: category.id,
                                });
                                await interaction.editReply({
                                  content:
                                    "New Category Created, Request Processed.",
                                });
                              } else {
                                await interaction.editReply({
                                  content: "Category option ignored",
                                });
                              }
                            });
                        })
                        .catch((e) => {
                          error(e.message);
                          interaction.editReply({
                            content:
                              'Failed to add confirmation emojis "✅" "❌". Discarding changes.',
                          });
                          return;
                        });
                    }
                  } else {
                    await interaction.editReply({
                      content: "Request processed.",
                    });
                  }
                } else {
                  await interaction.reply({
                    content: "You are not allowed to use this command.",
                    ephemeral: false,
                  });
                }
                return;
              }
              case "lock": {
                const channel = options.getChannel("channel_name");
                try {
                  if (member.permissions.serialize().ADMINISTRATOR) {
                    if (channel !== null) {
                      if (
                        await channel
                          .permissionsFor(guild.roles.everyone)
                          .has("VIEW_CHANNEL")
                      ) {
                        await channel.permissionOverwrites.set([
                          {
                            id: guild.roles.everyone,
                            deny: [Permissions.FLAGS.SEND_MESSAGES],
                          },
                        ]);
                        await interaction.reply({
                          content: "Locked " + channel.name,
                          ephemeral: true,
                        });
                      } else {
                        await interaction.reply({
                          content:
                            "Unable to lock as it is not accessible to everyone.",
                          ephemeral: true,
                        });
                      }
                    } else {
                      const channels = client.channels.cache;
                      const total = channels.size;
                      let current = 0;
                      await interaction.deferReply({
                        content:
                          "Locking progress: " +
                          progressbar.splitBar(total, current) +
                          "%",
                      });
                      for (const ch of channels) {
                        if (
                          await ch[1]
                            .permissionsFor(guild.roles.everyone)
                            .has("VIEW_CHANNEL")
                        ) {
                          await ch[1].permissionOverwrites.set([
                            {
                              id: guild.roles.everyone,
                              deny: [Permissions.FLAGS.SEND_MESSAGES],
                            },
                          ]);
                        }
                        current++;
                        await interaction.editReply({
                          content:
                            "Locking progress: " +
                            progressbar.splitBar(total, current) +
                            "%",
                        });
                      }
                      await interaction.editReply({
                        content: "Locked all channels.",
                      });
                    }
                  } else {
                    await interaction.reply({
                      content: "You are not allowed to use this command.",
                      ephemeral: false,
                    });
                  }
                } catch (e) {
                  error(e.message);
                  await interaction.reply({
                    content: "Failed to lock all/some channels.",
                    ephemeral: true,
                  });
                }
                return;
              }
              case "unlock": {
                const channel = options.getChannel("channel_name");
                try {
                  if (member.permissions.serialize().ADMINISTRATOR) {
                    if (channel !== null) {
                      if (
                        await channel
                          .permissionsFor(guild.roles.everyone)
                          .has("VIEW_CHANNEL")
                      ) {
                        await channel.permissionOverwrites.set([
                          {
                            id: guild.roles.everyone,
                            allow: [Permissions.FLAGS.SEND_MESSAGES],
                          },
                        ]);
                        await interaction.reply({
                          content: "Unlocked " + channel.name,
                          ephemeral: true,
                        });
                      } else {
                        await interaction.reply({
                          content:
                            "Unable to unlock as it is not accessible to everyone.",
                          ephemeral: true,
                        });
                      }
                    } else {
                      const channels = client.channels.cache;
                      const total = channels.size;
                      let current = 0;
                      await interaction.deferReply({
                        content:
                          "Unlocking progress: " +
                          progressbar.splitBar(total, current) +
                          "%",
                      });
                      for (const ch of channels) {
                        if (
                          await ch[1]
                            .permissionsFor(guild.roles.everyone)
                            .has("VIEW_CHANNEL")
                        ) {
                          await ch[1].permissionOverwrites.set([
                            {
                              id: guild.roles.everyone,
                              allow: [Permissions.FLAGS.SEND_MESSAGES],
                            },
                          ]);
                        }
                        current++;
                        await interaction.editReply({
                          content:
                            "Unlocking progress: " +
                            progressbar.splitBar(total, current) +
                            "%",
                        });
                      }
                      await interaction.editReply({
                        content: "Unlocked all channels.",
                      });
                    }
                  } else {
                    await interaction.reply({
                      content: "You are not allowed to use this command.",
                      ephemeral: false,
                    });
                  }
                } catch (e) {
                  error(e.message);
                  await interaction.reply({
                    content: "Failed to unlock all/some channels.",
                    ephemeral: true,
                  });
                }
                return;
              }
              case "roles": {
                const server_roles = await guild.roles.fetch();
                const user_roles = member.roles.cache.map((role) => role.name);
                let bot = await guild.members.fetch(client.user.id);
                const bot_roles = bot.roles.cache;
                const filter =
                  options.getString("degree_identifier") !== null
                    ? options.getString("degree_identifier")
                    : ""; //.toLowerCase()
                let filtered_roles = [];
                server_roles.forEach((role) => {
                  if (
                    filter === "" ||
                    role.name.toLowerCase().includes(filter.toLowerCase())
                  ) {
                    let is_bot_role_higher = false;

                    bot_roles.forEach((bot_role) => {
                      if (bot_role.comparePositionTo(role) > 0) {
                        is_bot_role_higher = true;
                      }
                    });
                    if (is_bot_role_higher) {
                      role.belongs_to_user = user_roles.indexOf(role.name) > -1;
                      filtered_roles.push(role);
                    }
                  }
                });
                if (filtered_roles.length > 0) {
                  user_roles_request[user.id] = {
                    index: 0,
                    pages: generatePages(filtered_roles),
                    interaction: interaction,
                  };

                  await interaction.reply({
                    components: get_page(user.id),
                    ephemeral: true,
                  });
                } else {
                  await interaction.reply({
                    content:
                      "Did not find any role matching your filter, to get all roles please leave the role filter option empty",
                    ephemeral: true,
                  });
                }
                return;
              }
              case "sync": {
                try {
                  if (member.permissions.serialize().ADMINISTRATOR) {
                    const channels = client.channels.cache;
                    const total = channels.size;
                    let current = 0;
                    await interaction.deferReply({
                      content:
                        "Syncing progress: " +
                        progressbar.splitBar(total, current) +
                        "%",
                    });
                    for (const ch of channels) {
                      if (ch[1].parentId !== null) {
                        await ch[1].lockPermissions();
                      }
                      current++;
                      await interaction.editReply({
                        content:
                          "Syncing progress: " +
                          progressbar.splitBar(total, current) +
                          "%",
                      });
                    }
                    await interaction.editReply({
                      content: "Synced all channels.",
                    });
                  } else {
                    await interaction.reply({
                      content: "You are not allowed to use this command.",
                      ephemeral: false,
                    });
                  }
                } catch (e) {
                  error(e.message);
                  await interaction.reply({
                    content: "Failed to Sync all/some channels.",
                    ephemeral: true,
                  });
                }
                return;
              }
            }
          }
          if (interaction.isButton()) {
            const { user, guild, customId } = interaction;
            if (user_roles_request[user.id] !== undefined) {
              switch (customId) {
                case "next": {
                  user_roles_request[user.id]["index"] += 1;
                  await interaction.update({ components: get_page(user.id) });
                  return;
                }
                case "previous": {
                  user_roles_request[user.id]["index"] -= 1;
                  interaction.message.components = get_page(user.id);
                  await interaction.update({ components: get_page(user.id) });
                  return;
                }
                default: {
                  // @ts-ignore
                  async function sendUpdatedRolesInteraction(inter, uid, stu) {
                    inter.component.setStyle(stu);
                    update_button(uid, inter.component);
                    await inter.update({ components: get_page(uid) });
                  }

                  // @ts-ignore
                  async function sendError(inter, e) {
                    error(e.message);
                    await inter.reply({
                      content:
                        "Do not have the permissions to give you the role.",
                      ephemeral: true,
                    });
                  }

                  const role = await guild.roles.cache.get(customId);
                  await guild.members
                    .fetch({ user: user.id, force: true })
                    .then((member) => {
                      if (member.roles.cache.has(customId)) {
                        member.roles
                          .remove(role)
                          .then(() => {
                            sendUpdatedRolesInteraction(
                              interaction,
                              user.id,
                              "SECONDARY"
                            );
                          })
                          .catch((e) => {
                            sendError(interaction, e);
                          });
                      } else {
                        member.roles
                          .add(role)
                          .then(() => {
                            sendUpdatedRolesInteraction(
                              interaction,
                              user.id,
                              "SUCCESS"
                            );
                          })
                          .catch((e) => {
                            sendError(interaction, e);
                          });
                      }
                    })
                    .catch((err) => {
                      error(err.message);
                      sendError(
                        interaction,
                        "Could not retrieve user information."
                      );
                    });

                  return;
                }
              }
            } else {
              await interaction.reply({
                content:
                  "close this session as information is lost, Open a new session.",
                ephemeral: true,
              });
            }
          }
        });
        client.on("messageCreate", async (message) => {
          const { content, author, channel } = message;
          if (filter.isProfane(content) !== false) {
            if (message.deletable) {
              await message.delete();
              channel.send({
                embeds: [
                  new MessageEmbed()
                    .setAuthor({
                      name: author.username,
                    })
                    .setThumbnail(emojies.random())
                    .addFields({
                      name: "Filtered message",
                      value: filter.clean(content).replace("*", "#"),
                    })
                    .setTimestamp(),
                ],
              });
            }
          }
        });
        client.on("messageDelete", async (message) => {
          const { content, author, channel, guild } = message;
          if (!author.bot) {
            guild.systemChannel.send({
              embeds: [
                new MessageEmbed()
                  .setTitle("Message deleted")
                  .setAuthor({
                    name: author.username,
                  })
                  .setThumbnail(author.avatarURL())
                  .addFields({
                    name: "Message",
                    value: content,
                  })
                  .setTimestamp(),
              ],
            });
          }
        });
        await client.login(token);
      } catch (exception) {
        error(exception);
      }
    } else {
      error(
        "Client Id missing. This is the application id in the general section of your application."
      );
    }
  } else {
    error(
      "Token is missing. This is given to you when you create a bot on discord developer website."
    );
  }
}

start();
