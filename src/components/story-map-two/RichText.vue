<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";

const props = defineProps<{ text: string }>();

const md = new MarkdownIt({ html: false, breaks: true, linkify: true });
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener");
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const rendered = computed(() => md.render(props.text));
</script>

<template>
  <div class="rich-text" v-html="rendered" />
</template>

<style scoped>
.rich-text :deep(p) {
  margin-top: 0.5rem;
  color: var(--gray-600);
}
.rich-text :deep(p + p) {
  margin-top: 0.5rem;
  color: var(--gray-600);
}
.rich-text :deep(strong) {
  color: var(--heigit-red);
  font-weight: 600;
}
.rich-text :deep(a) {
  color: var(--heigit-red);
  text-decoration: underline;
}
.rich-text :deep(ul),
.rich-text :deep(ol) {
  margin-top: 0.5rem;
  padding-left: 1.25rem;
}
.rich-text :deep(ul) {
  list-style: disc;
}
.rich-text :deep(ol) {
  list-style: decimal;
}
</style>
