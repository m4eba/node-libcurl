/**
 * Copyright (c) Jonathan Cardoso Machado. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Curl } from './Curl'
import { Easy } from './Easy'
import { Impersonate } from './generated/ImpersonatePresets'

/**
 * Sets the `impersonate` option on the given handle.
 *
 * @public
 */
export function impersonate(handle: Curl | Easy, target: Impersonate) {
  handle.setOpt(Curl.option.IMPERSONATE, target)
}
