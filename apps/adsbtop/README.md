# @squawk/adsbtop

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/adsbtop)](https://www.npmjs.com/package/@squawk/adsbtop) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

A terminal dashboard for live ADS-B aircraft tracking, built on [`@squawk/adsb-feed`](../../packages/libs/adsb-feed). Connects to a local [dump1090-fa](https://github.com/flightaware/dump1090) station and renders tracked aircraft directly in your terminal.

> [!NOTE]
> Early scaffold - the `adsbtop` command currently starts and renders a placeholder screen. Live aircraft tracking is not yet implemented.

## Installation

```bash
npm install -g @squawk/adsbtop
```

## Usage

```bash
adsbtop
```
