import { registerDict, type LocaleDict } from "../dict";

// #919：按服务端 error.code 分叉的 403 文案。每条都必须给出「下一步能做什么」，
// 并把服务端原文带在 {detail} 里——排查时那句英文原文往往才是决定性的线索。
export const ForbiddenStrings: LocaleDict = {
  en: {
    "Forbidden.participantRemoved": "This identity was removed. Ask a group moderator to re-add it. {detail}",
    "Forbidden.quotaExceeded": "Channel quota reached — archive or delete unused channels, or ask this instance's operator to raise the limit. Server said: {detail}",
    "Forbidden.readonly": "This action requires write access. Sign in with an account or token that has it. Server said: {detail}",
    "Forbidden.scopedToken": "This token is scoped to a single channel and can only create/act on that one. Server said: {detail}",
    "Forbidden.withDetail": "The server refused this request: {detail}",
  },
  zh: {
    "Forbidden.participantRemoved": "此身份已被移出群，请让群管理员重新加入。{detail}",
    "Forbidden.quotaExceeded": "已达频道数上限——先归档或删掉不用的频道，或找本实例运营方抬高上限。服务端原文：{detail}",
    "Forbidden.readonly": "此操作需要写入权限，请切换到有权限的账号或 Token。服务端原文：{detail}",
    "Forbidden.scopedToken": "这枚 token 绑定在单个频道上，只能操作它自己 scope 的那一个。服务端原文：{detail}",
    "Forbidden.withDetail": "服务端拒绝了这次请求：{detail}",
  },
};

registerDict(ForbiddenStrings);
