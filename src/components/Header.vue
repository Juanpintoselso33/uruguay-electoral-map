<template>
  <header class="header">
    <div class="header-content">
      <div class="header-left">
        <RegionSelector
          :regions="regions"
          :currentRegion="currentRegion"
          @regionSelected="handleRegionSelected"
          :isLoading="regionStore.isLoading"
          :isMenuOpen="isMenuOpen"
          @toggleMenu="toggleMenu"
        />
      </div>
      <h1 class="header-title">
        Votos por listas por zona de {{ currentRegionName }}
      </h1>
      <div class="header-right">
        <a
          href="https://github.com/juanpintoselso33"
          target="_blank"
          rel="noopener noreferrer"
          class="github-link"
        >
          <svg
            class="github-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
          <span>Juan Pintos Elso</span>
        </a>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRegionStore } from "@/stores/regionStore";
import RegionSelector from "./RegionSelector.vue";
import type { Region } from "@/types/Region";
import { storeToRefs } from "pinia";

const regionStore = useRegionStore();
const { currentRegion, regions, isLoading } = storeToRefs(regionStore);

const isMenuOpen = ref(false);

const currentRegionName = computed(() => currentRegion.value.name);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const handleRegionSelected = async (region: Region) => {
  await regionStore.setCurrentRegion(region);
  console.log("Header: Region selected", region.name);
  isMenuOpen.value = false;
};
</script>

<style lang="scss" scoped>
@import "@/styles/variables";

.header {
  background-color: $primary-color;
  color: $background-color;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2000;
  width: 100%;

  &-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  &-left {
    flex: 0 0 auto;
  }

  &-title {
    font-size: 1.2rem;
    margin: 0;
    text-align: center;
    flex: 1;
  }

  &-right {
    flex: 0 0 auto;
  }

  .github-link {
    display: flex;
    align-items: center;
    color: $background-color;
    font-size: 0.9rem;
    text-decoration: none;
    transition: color 0.3s ease;

    &:hover {
      color: lighten($primary-color, 30%);
    }

    .github-icon {
      width: 24px;
      height: 24px;
      margin-right: 8px;
    }

    span {
      display: inline;
    }
  }

  @media (max-width: ($mobile-breakpoint - 1)) {
    &-content {
      flex-wrap: wrap;
      padding-bottom: 20px;
    }

    &-left,
    &-right {
      flex-basis: 50%;
    }

    &-left {
      order: 1;
    }

    &-right {
      order: 2;
      display: flex;
      justify-content: flex-end;
      padding-right: 5px;
    }

    &-title {
      order: 3;
      flex-basis: 100%;
      font-size: 1rem;
      margin-top: 5px;
      text-align: center;
    }

    .github-link {
      font-size: 0.8rem;

      .github-icon {
        width: 20px;
        height: 20px;
        margin-right: 4px;
      }

      span {
        font-size: 0.7rem;
      }
    }
  }

  @media (max-width: 420px) {
    .github-link {
      span {
        display: none;
      }
    }
  }
}
</style>
